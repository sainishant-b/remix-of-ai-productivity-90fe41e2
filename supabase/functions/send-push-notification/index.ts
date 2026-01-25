import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64url to Uint8Array
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...uint8Array));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate ECDH key pair for encryption
async function generateECDHKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

// Export public key to raw format
async function exportPublicKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return new Uint8Array(exported);
}

// Import subscriber's public key
async function importSubscriberKey(p256dh: string): Promise<CryptoKey> {
  const keyData = base64UrlToUint8Array(p256dh);
  return await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
}

// Derive shared secret using ECDH
async function deriveSharedSecret(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
}

// HKDF extract and expand
async function hkdf(salt: Uint8Array, ikm: ArrayBuffer, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    salt.length ? (salt.buffer as ArrayBuffer) : new ArrayBuffer(32),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const prk = await crypto.subtle.sign('HMAC', key, ikm);
  
  const prkKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const infoWithCounter = new Uint8Array(info.length + 1);
  infoWithCounter.set(info);
  infoWithCounter[info.length] = 1;
  
  const okm = await crypto.subtle.sign('HMAC', prkKey, infoWithCounter);
  return new Uint8Array(okm).slice(0, length);
}

// Encrypt payload using aes128gcm
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);
  
  // Generate server ECDH key pair
  const serverKeyPair = await generateECDHKeyPair();
  const serverPublicKey = await exportPublicKey(serverKeyPair.publicKey);
  
  // Import subscriber's public key and derive shared secret
  const subscriberPublicKey = await importSubscriberKey(p256dh);
  const sharedSecret = await deriveSharedSecret(serverKeyPair.privateKey, subscriberPublicKey);
  
  // Get auth secret and subscriber public key as bytes
  const authSecret = base64UrlToUint8Array(auth);
  const clientPublicKey = base64UrlToUint8Array(p256dh);
  
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Derive PRK using auth secret - WebPush info structure
  const prkInfo = new Uint8Array([
    ...encoder.encode('WebPush: info\0'),
    ...clientPublicKey,
    ...serverPublicKey
  ]);
  const prk = await hkdf(authSecret, sharedSecret, prkInfo, 32);
  
  // Derive content encryption key and nonce using salt
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0');
  
  const contentEncryptionKey = await hkdf(salt, prk.buffer as ArrayBuffer, cekInfo, 16);
  const nonce = await hkdf(salt, prk.buffer as ArrayBuffer, nonceInfo, 12);
  
  // Import AES key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentEncryptionKey.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // Add padding delimiter (0x02 for final record)
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter
  
  // Encrypt with the nonce
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce.buffer as ArrayBuffer },
    aesKey,
    paddedPayload
  );
  
  // Build the encrypted content coding header + ciphertext
  // Header: salt (16) + rs (4) + idlen (1) + keyid (serverPublicKey.length)
  const rs = 4096; // record size
  
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  header[16] = (rs >> 24) & 0xff;
  header[17] = (rs >> 16) & 0xff;
  header[18] = (rs >> 8) & 0xff;
  header[19] = rs & 0xff;
  header[20] = serverPublicKey.length;
  header.set(serverPublicKey, 21);
  
  // Combine header and ciphertext
  const encrypted = new Uint8Array(header.length + encryptedData.byteLength);
  encrypted.set(header, 0);
  encrypted.set(new Uint8Array(encryptedData), header.length);
  
  return { encrypted, serverPublicKey, salt };
}

// Create VAPID JWT token
async function createVapidJwt(
  audience: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ token: string; publicKey: string }> {
  const encoder = new TextEncoder();
  
  // Decode the VAPID keys
  const publicKeyBytes = base64UrlToUint8Array(vapidPublicKey);
  const privateKeyBytes = base64UrlToUint8Array(vapidPrivateKey);
  
  // Create JWK from raw keys for P-256 curve
  // The public key in raw format is 65 bytes: 0x04 + 32 bytes X + 32 bytes Y
  // The private key is 32 bytes (the D value)
  
  let x: string, y: string;
  
  if (publicKeyBytes.length === 65 && publicKeyBytes[0] === 0x04) {
    // Uncompressed public key format
    x = uint8ArrayToBase64Url(publicKeyBytes.slice(1, 33));
    y = uint8ArrayToBase64Url(publicKeyBytes.slice(33, 65));
  } else if (publicKeyBytes.length === 64) {
    // Raw X,Y coordinates without prefix
    x = uint8ArrayToBase64Url(publicKeyBytes.slice(0, 32));
    y = uint8ArrayToBase64Url(publicKeyBytes.slice(32, 64));
  } else {
    throw new Error(`Invalid VAPID public key length: ${publicKeyBytes.length}`);
  }
  
  const d = uint8ArrayToBase64Url(privateKeyBytes);
  
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d,
  };
  
  // Import the private key for signing
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  
  // JWT header
  const header = { typ: 'JWT', alg: 'ES256' };
  const headerB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  
  // JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60, // 12 hours
    sub: 'mailto:push@lovable.app'
  };
  const payloadB64 = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(payload)));
  
  // Sign
  const signatureInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const signatureArrayBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    signatureInput
  );
  
  // ECDSA signature from WebCrypto is in DER format, we need raw R||S format
  const signatureBytes = new Uint8Array(signatureArrayBuffer);
  const rawSignature = derToRaw(signatureBytes);
  
  const signatureB64 = uint8ArrayToBase64Url(rawSignature);
  
  return {
    token: `${headerB64}.${payloadB64}.${signatureB64}`,
    publicKey: vapidPublicKey
  };
}

// Convert DER encoded ECDSA signature to raw format (R || S)
function derToRaw(der: Uint8Array): Uint8Array {
  // WebCrypto may return raw format directly (64 bytes for P-256)
  if (der.length === 64) {
    return der;
  }
  
  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  if (der[0] !== 0x30) {
    // Not DER format, assume it's already raw
    return der;
  }
  
  let offset = 2; // Skip 0x30 and length byte
  
  // Read R
  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature format');
  }
  offset++;
  const rLength = der[offset];
  offset++;
  let r = der.slice(offset, offset + rLength);
  offset += rLength;
  
  // Read S
  if (der[offset] !== 0x02) {
    throw new Error('Invalid DER signature format');
  }
  offset++;
  const sLength = der[offset];
  offset++;
  let s = der.slice(offset, offset + sLength);
  
  // Remove leading zeros and pad to 32 bytes
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  
  const result = new Uint8Array(64);
  result.set(r, 32 - r.length);
  result.set(s, 64 - s.length);
  
  return result;
}

// Send FCM push notification
async function sendFcmNotification(
  fcmServerKey: string,
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${fcmServerKey}`,
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title,
          body,
          sound: 'default',
          icon: 'ic_launcher',
          color: '#6366f1',
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
        time_to_live: 86400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FCM error response:', errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log('FCM response:', JSON.stringify(result));
    
    if (result.failure > 0) {
      const errorInfo = result.results?.[0]?.error;
      return { success: false, error: errorInfo || 'FCM delivery failed' };
    }

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown FCM error';
    return { success: false, error: errorMessage };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { userId, title, body, data, tag } = await req.json();

    console.log(`Sending push notification to user ${userId}: ${title}`);

    // Get ALL user's push subscriptions (both web and FCM)
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user');
      return new Response(
        JSON.stringify({ message: 'No subscriptions found', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = JSON.stringify({
      title,
      body,
      tag: tag || `notification-${Date.now()}`,
      data: data || {},
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    });

    let webSuccessCount = 0;
    let fcmSuccessCount = 0;
    let failCount = 0;
    const expiredSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      const isFcm = subscription.endpoint.startsWith('fcm:');
      const isApns = subscription.endpoint.startsWith('apns:');
      
      if (isFcm) {
        // Handle FCM (Android) push
        if (!fcmServerKey) {
          console.log('FCM_SERVER_KEY not configured, skipping FCM subscription');
          failCount++;
          continue;
        }

        const fcmToken = subscription.endpoint.replace('fcm:', '');
        console.log(`Sending FCM notification to token: ${fcmToken.substring(0, 20)}...`);
        
        const result = await sendFcmNotification(
          fcmServerKey,
          fcmToken,
          title,
          body,
          data || {}
        );

        if (result.success) {
          fcmSuccessCount++;
          console.log(`Successfully sent FCM notification for subscription ${subscription.id}`);
        } else {
          // Check for invalid/expired token errors
          if (result.error?.includes('NotRegistered') || result.error?.includes('InvalidRegistration')) {
            expiredSubscriptions.push(subscription.id);
            console.log(`FCM token expired for subscription ${subscription.id}`);
          } else {
            failCount++;
            console.error(`Failed to send FCM for subscription ${subscription.id}: ${result.error}`);
          }
        }
      } else if (isApns) {
        // APNs would require Apple Push Notification service setup
        // For now, log that it's not supported
        console.log(`APNs subscription ${subscription.id} - server push not implemented yet`);
        failCount++;
      } else {
        // Handle Web Push
        if (!vapidPublicKey || !vapidPrivateKey) {
          console.log('VAPID keys not configured, skipping web push subscription');
          failCount++;
          continue;
        }

        try {
          console.log(`Processing web push subscription ${subscription.id} for endpoint: ${subscription.endpoint.substring(0, 50)}...`);
          
          const endpointUrl = new URL(subscription.endpoint);
          const audience = endpointUrl.origin;
          
          const { encrypted } = await encryptPayload(
            payload,
            subscription.p256dh_key,
            subscription.auth_key
          );
          
          const { token, publicKey } = await createVapidJwt(audience, vapidPublicKey, vapidPrivateKey);
          
          const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              'TTL': '86400',
              'Urgency': 'high',
              'Authorization': `vapid t=${token}, k=${publicKey}`,
            },
            body: encrypted.buffer as ArrayBuffer,
          });

          if (response.status === 201 || response.status === 200) {
            webSuccessCount++;
            console.log(`Successfully sent web push to subscription ${subscription.id}`);
          } else if (response.status === 404 || response.status === 410) {
            expiredSubscriptions.push(subscription.id);
            console.log(`Web push subscription ${subscription.id} expired, marking for deletion`);
          } else {
            failCount++;
            const responseText = await response.text();
            console.error(`Failed to send web push to subscription ${subscription.id}: ${response.status} ${responseText}`);
          }
        } catch (err) {
          failCount++;
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Error sending web push to subscription ${subscription.id}:`, errorMessage);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredSubscriptions.length > 0) {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', expiredSubscriptions);

      if (deleteError) {
        console.error('Error deleting expired subscriptions:', deleteError);
      } else {
        console.log(`Deleted ${expiredSubscriptions.length} expired subscriptions`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: 'Push notifications processed',
        sent: webSuccessCount + fcmSuccessCount,
        webPush: webSuccessCount,
        fcmPush: fcmSuccessCount,
        failed: failCount,
        expired: expiredSubscriptions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in send-push-notification:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
