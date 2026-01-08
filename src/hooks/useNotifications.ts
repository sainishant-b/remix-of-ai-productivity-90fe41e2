import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  icon?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string }[];
  requireInteraction?: boolean;
  silent?: boolean;
}

interface UseNotificationsReturn {
  permission: NotificationPermission | "unsupported";
  isSupported: boolean;
  isPushSupported: boolean;
  isPushSubscribed: boolean;
  requestPermission: () => Promise<boolean>;
  sendNotification: (options: NotificationOptions) => void;
  scheduleNotification: (options: NotificationOptions, delayMs: number) => number;
  cancelScheduledNotification: (timeoutId: number) => void;
  subscribeToPush: () => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
}

// VAPID public key (safe to ship in the client). Must be a real P-256 VAPID public key.
const VAPID_PUBLIC_KEY_RAW = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? "";
const VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY_RAW.trim().replace(/^"|"$/g, "");

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function validateVapidPublicKey(key: string): Promise<
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; reason: string }
> {
  if (!key) return { ok: false, reason: "missing" };

  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = urlBase64ToUint8Array(key);
  } catch {
    return { ok: false, reason: "not base64url" };
  }

  // Uncompressed P-256 public keys are 65 bytes and start with 0x04.
  if (bytes.length !== 65) return { ok: false, reason: `expected 65 bytes, got ${bytes.length}` };
  if (bytes[0] !== 0x04) return { ok: false, reason: "expected uncompressed key (0x04 prefix)" };

  // Optional deeper validation: ensure it's a real P-256 point.
  try {
    if (globalThis.crypto?.subtle?.importKey) {
      await globalThis.crypto.subtle.importKey(
        "raw",
        bytes,
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
      );
    }
  } catch {
    return { ok: false, reason: "invalid P-256 public key" };
  }

  return { ok: true, bytes };
}

function isCapacitorNative(): boolean {
  const cap = (window as any)?.Capacitor;
  try {
    if (cap && typeof cap.isNativePlatform === "function") return !!cap.isNativePlatform();
    if (cap && typeof cap.isNative === "boolean") return cap.isNative;
  } catch {
    // ignore
  }
  return false;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const supported = "Notification" in window && "serviceWorker" in navigator;
    const pushSupported = supported && "PushManager" in window;

    setIsSupported(supported);
    setIsPushSupported(pushSupported);

    if (supported) {
      setPermission(Notification.permission);

      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration);
          setSwRegistration(registration);

          if (!pushSupported) {
            setIsPushSubscribed(false);
            return;
          }

          // Check if already subscribed
          registration.pushManager
            .getSubscription()
            .then((subscription) => {
              setIsPushSubscribed(!!subscription);
            })
            .catch((error) => {
              console.warn("Push subscription check failed (push may be unsupported):", error);
              setIsPushSupported(false);
              setIsPushSubscribed(false);
            });
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "NOTIFICATION_CLICK") {
          // Handle notification click actions
          const { action, data } = event.data;

          if (data.type === "check-in" && action === "checkin") {
            // Dispatch custom event for check-in
            window.dispatchEvent(new CustomEvent("open-checkin"));
          } else if (data.type === "task-reminder" && action === "view") {
            // Navigate to task - handled by URL in sw.js
          }
        }
      });
    } else {
      setPermission("unsupported");
      setIsPushSupported(false);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast.error("Notifications are not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === "granted") {
        toast.success("Notifications enabled!");
        return true;
      } else if (result === "denied") {
        toast.error("Notifications were denied. You can enable them in browser settings.");
        return false;
      } else {
        toast.info("Notification permission was dismissed");
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Failed to request notification permission");
      return false;
    }
  }, [isSupported]);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    // Web Push requires PushManager (not available in all environments, especially some Android WebViews).
    if (!("PushManager" in window)) {
      toast.error("Push notifications aren't supported on this device/browser");
      return false;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.error("VAPID key not configured");
      toast.error("Push notifications not configured");
      return false;
    }

    try {
      // Get the session first (more reliable than getUser for checking auth state)
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user;
      
      if (!user) {
        // Try refreshing the session once before giving up
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        user = refreshedSession?.user ?? null;
        if (!user) {
          toast.error("You must be logged in to enable push notifications");
          return false;
        }
      }

      // Wait for service worker to be ready
      console.log("Waiting for service worker...");
      const registration = await navigator.serviceWorker.ready;
      console.log("Service worker ready for push subscription");

      // Validate + convert VAPID key
      const validation = await validateVapidPublicKey(VAPID_PUBLIC_KEY);
      if (validation.ok === false) {
        console.error("Invalid VAPID public key:", validation.reason);
        toast.error(`Invalid push key: ${validation.reason}`);
        return false;
      }

      // If already subscribed, reuse the existing subscription (some browsers reject calling subscribe() again)
      const existingSubscription = await registration.pushManager.getSubscription();
      console.log(
        "Existing subscription:",
        existingSubscription ? existingSubscription.endpoint : null
      );

      if (existingSubscription) {
        const subscriptionJSON = existingSubscription.toJSON();

        const { error } = await supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              endpoint: subscriptionJSON.endpoint!,
              p256dh_key: subscriptionJSON.keys?.p256dh || "",
              auth_key: subscriptionJSON.keys?.auth || "",
            },
            {
              onConflict: "user_id,endpoint",
            }
          );

        if (error) {
          console.error("Error saving push subscription:", error);
          toast.error("Failed to save push subscription");
          return false;
        }

        setIsPushSubscribed(true);
        toast.success("Push notifications already enabled!");
        return true;
      }

      // Subscribe to push
      console.log("Attempting to subscribe to push...");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: validation.bytes,
      });

      console.log("Push subscription created:", subscription.endpoint);
      const subscriptionJSON = subscription.toJSON();

      // Save subscription to database
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscriptionJSON.endpoint!,
            p256dh_key: subscriptionJSON.keys?.p256dh || "",
            auth_key: subscriptionJSON.keys?.auth || "",
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (error) {
        console.error("Error saving push subscription:", error);
        toast.error("Failed to save push subscription");
        return false;
      }

      setIsPushSubscribed(true);
      toast.success("Push notifications enabled!");
      return true;
    } catch (error: unknown) {
      // Log full error object for debugging
      console.error("Error subscribing to push - full object:", error);
      console.error("Error type:", typeof error);
      console.error("Error constructor:", error?.constructor?.name);
      
      if (error instanceof DOMException) {
        console.error("DOMException details:", {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack,
        });

        if (error.name === "AbortError") {
          toast.error(
            isCapacitorNative()
              ? "Web Push isn't supported inside the native app. Use installable web app (PWA) for Web Push, or set up native push (Firebase)."
              : "Push subscription was rejected. If you already enabled push before, disable it first and then re-enable."
          );
          return false;
        }

        if (error.name === "NotAllowedError") {
          toast.error("Push notifications were denied. Please enable them in browser settings.");
          return false;
        }

        if (error.name === "InvalidStateError") {
          toast.error("Push subscription already exists or is in an invalid state.");
          return false;
        }

        toast.error(`Push error: ${error.name} - ${error.message}`);
      } else if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          stack: error.stack,
        });
        toast.error(`Push error: ${error.message}`);
      } else {
        console.error("Unknown error type:", JSON.stringify(error, null, 2));
        toast.error("Failed to enable push notifications");
      }
      return false;
    }
  }, []);

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!swRegistration) {
      return false;
    }

    try {
      const subscription = await swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }

      setIsPushSubscribed(false);
      toast.success("Push notifications disabled");
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      toast.error("Failed to disable push notifications");
      return false;
    }
  }, [swRegistration]);

  const sendNotification = useCallback(async (options: NotificationOptions) => {
    if (!isSupported || permission !== "granted") {
      console.log("Notifications not available or not permitted");
      toast.error("Notifications are not enabled");
      return;
    }

    try {
      // Always get the current service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      await registration.showNotification(options.title, {
        body: options.body,
        tag: options.tag || `notification-${Date.now()}`,
        icon: options.icon || "/favicon.ico",
        data: options.data,
        requireInteraction: options.requireInteraction,
        silent: options.silent,
      });
      
      toast.success("Notification sent!");
    } catch (error) {
      console.error("Failed to send notification:", error);
      // Fallback to regular notification
      try {
        new Notification(options.title, {
          body: options.body,
          tag: options.tag || `notification-${Date.now()}`,
          icon: options.icon || "/favicon.ico",
        });
        toast.success("Notification sent!");
      } catch (fallbackError) {
        console.error("Fallback notification also failed:", fallbackError);
        toast.error("Failed to send notification");
      }
    }
  }, [isSupported, permission]);

  const scheduleNotification = useCallback((options: NotificationOptions, delayMs: number): number => {
    const timeoutId = window.setTimeout(() => {
      sendNotification(options);
    }, delayMs);
    
    return timeoutId;
  }, [sendNotification]);

  const cancelScheduledNotification = useCallback((timeoutId: number) => {
    window.clearTimeout(timeoutId);
  }, []);

  return {
    permission,
    isSupported,
    isPushSupported,
    isPushSubscribed,
    requestPermission,
    sendNotification,
    scheduleNotification,
    cancelScheduledNotification,
    subscribeToPush,
    unsubscribeFromPush,
  };
};

// Singleton instance for use outside of React components
let notificationInstance: {
  sendNotification: (options: NotificationOptions) => void;
} | null = null;

export const getNotificationSender = () => {
  if (!notificationInstance && "Notification" in window && Notification.permission === "granted") {
    notificationInstance = {
      sendNotification: (options: NotificationOptions) => {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(options.title, {
              body: options.body,
              tag: options.tag || `notification-${Date.now()}`,
              icon: options.icon || "/favicon.ico",
              data: options.data,
              requireInteraction: options.requireInteraction,
              silent: options.silent,
            });
          });
        } else {
          new Notification(options.title, {
            body: options.body,
            icon: options.icon || "/favicon.ico",
          });
        }
      },
    };
  }
  return notificationInstance;
};
