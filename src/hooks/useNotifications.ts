import { useState, useEffect, useCallback, useRef } from "react";
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

// Avoid attaching duplicate message listeners when this hook is used in multiple places.
let swMessageListenerAttached = false;

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

// Prevent concurrent subscribe/unsubscribe operations
let isProcessingPush = false;

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  // Prefer an existing registration for our /sw.js
  const regs = await navigator.serviceWorker.getRegistrations();
  const existing = regs.find((r) =>
    [r.active?.scriptURL, r.installing?.scriptURL, r.waiting?.scriptURL]
      .filter(Boolean)
      .some((u) => (u as string).includes("/sw.js"))
  );

  if (existing) {
    try {
      await existing.update();
    } catch {
      // ignore transient update failures
    }
    return existing;
  }

  // Force bypassing cached SW when VAPID keys / builds change.
  return await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
}

async function resetAppServiceWorkers(): Promise<void> {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) =>
        [r.active?.scriptURL, r.installing?.scriptURL, r.waiting?.scriptURL]
          .filter(Boolean)
          .some((u) => (u as string).includes("/sw.js"))
      )
      .map((r) => r.unregister())
  );
}

export const useNotifications = (): UseNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSupported, setIsSupported] = useState(false);
  const [isPushSupported, setIsPushSupported] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const supported = "Notification" in window && "serviceWorker" in navigator;
    const pushSupported = supported && "PushManager" in window;

    setIsSupported(supported);
    setIsPushSupported(pushSupported);

    if (supported) {
      setPermission(Notification.permission);

      // Check subscription state from ALL service worker registrations (not just ours)
      const checkSubscriptionState = async () => {
        if (!pushSupported) {
          setIsPushSubscribed(false);
          return;
        }

        try {
          // First try our specific SW registration
          const registration = await ensureServiceWorkerRegistration();
          swRegistrationRef.current = registration;
          console.log("Service Worker registered:", registration);

          let subscription = await registration.pushManager.getSubscription();
          
          // If not found on our registration, check all registrations (browser may have subscription on different SW)
          if (!subscription) {
            const allRegs = await navigator.serviceWorker.getRegistrations();
            for (const reg of allRegs) {
              try {
                const sub = await reg.pushManager.getSubscription();
                if (sub) {
                  subscription = sub;
                  console.log("Found subscription on different SW registration");
                  break;
                }
              } catch {
                // ignore
              }
            }
          }

          console.log("Push subscription state on mount:", subscription ? "SUBSCRIBED" : "NOT_SUBSCRIBED");
          setIsPushSubscribed(!!subscription);
        } catch (error) {
          console.warn("Push subscription check failed:", error);
          setIsPushSubscribed(false);
        }
      };

      checkSubscriptionState();

      // Listen for messages from service worker (attach once)
      if (!swMessageListenerAttached) {
        swMessageListenerAttached = true;
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
      }
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
    if (isProcessingPush) {
      console.log("Push operation already in progress");
      return false;
    }
    isProcessingPush = true;

    try {
      return await doSubscribeToPush();
    } finally {
      isProcessingPush = false;
    }
  }, []);

  const doSubscribeToPush = async (): Promise<boolean> => {
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

    const saveSubscription = async (userId: string, subscription: PushSubscription) => {
      const subscriptionJSON = subscription.toJSON();
      const endpoint = subscriptionJSON.endpoint ?? subscription.endpoint;

      return await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint,
            p256dh_key: subscriptionJSON.keys?.p256dh || "",
            auth_key: subscriptionJSON.keys?.auth || "",
          },
          {
            onConflict: "user_id,endpoint",
          }
        );
    };

    try {
      // Get the session first (more reliable than getUser for checking auth state)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      console.log("Session check:", session ? "found" : "null", sessionError ? `error: ${sessionError.message}` : "");
      let user = session?.user;

      if (!user) {
        // Try refreshing the session once before giving up
        console.log("No session, attempting refresh...");
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        console.log("Refresh result:", refreshedSession ? "success" : "failed", refreshError ? `error: ${refreshError.message}` : "");
        user = refreshedSession?.user ?? null;
        if (!user) {
          toast.error("You must be logged in to enable push notifications");
          return false;
        }
      }

      // Ensure service worker registration (helps after preview rebuilds / key changes)
      console.log("Ensuring service worker registration...");
      const registration = swRegistrationRef.current ?? (await ensureServiceWorkerRegistration());
      swRegistrationRef.current = registration;

      // Also wait until at least one SW is ready/active
      await navigator.serviceWorker.ready;
      console.log("Service worker ready for push subscription");

      // Validate + convert VAPID key
      const validation = await validateVapidPublicKey(VAPID_PUBLIC_KEY);
      if (validation.ok === false) {
        console.error("Invalid VAPID public key:", validation.reason);
        toast.error(`Invalid push key: ${validation.reason}`);
        return false;
      }

      // Check ALL SW registrations for existing subscription (not just ours - browser may have it on a different one)
      let existingSubscription = await registration.pushManager.getSubscription();
      
      if (!existingSubscription) {
        const allRegs = await navigator.serviceWorker.getRegistrations();
        for (const reg of allRegs) {
          try {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              existingSubscription = sub;
              console.log("Found existing subscription on different SW registration");
              break;
            }
          } catch {
            // ignore
          }
        }
      }

      console.log(
        "Existing subscription:",
        existingSubscription ? existingSubscription.endpoint : null
      );

      if (existingSubscription) {
        const { error } = await saveSubscription(user.id, existingSubscription);

        if (error) {
          console.error("Error saving push subscription:", error);
          toast.error("Failed to save push subscription");
          return false;
        }

        setIsPushSubscribed(true);
        toast.success("Push notifications enabled!");
        return true;
      }

      // Subscribe to push
      console.log("Attempting to subscribe to push...");
      console.log("VAPID key length:", VAPID_PUBLIC_KEY.length);
      console.log("VAPID key (first 20 chars):", VAPID_PUBLIC_KEY.substring(0, 20));
      console.log("VAPID key validation passed, bytes length:", validation.bytes.length);

      let activeRegistration = registration;

      const subscribeOnce = (reg: ServiceWorkerRegistration) =>
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: validation.bytes,
        });

      let subscription: PushSubscription | undefined;
      const MAX_RETRIES = 3;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Push subscription attempt ${attempt}/${MAX_RETRIES}...`);
          subscription = await subscribeOnce(activeRegistration);
          console.log("Push subscription succeeded on attempt", attempt);
          break;
        } catch (e) {
          console.warn(`Push subscription attempt ${attempt} failed:`, e);

          // AbortError often means the browser push backend rejected/failed this request.
          if (e instanceof DOMException && e.name === "AbortError") {
            if (attempt < MAX_RETRIES) {
              const delay = 1500 * attempt; // Exponential backoff: 1.5s, 3s, 4.5s
              console.log(`Retrying in ${delay}ms...`);
              await new Promise((r) => setTimeout(r, delay));
              continue;
            }

            // Last resort: reset SW (can get wedged after key changes / stale registrations)
            console.log("AbortError persisted; resetting service worker and retrying once...");
            try {
              await resetAppServiceWorkers();
              activeRegistration = await ensureServiceWorkerRegistration();
              swRegistrationRef.current = activeRegistration;
              await navigator.serviceWorker.ready;

              subscription = await subscribeOnce(activeRegistration);
              console.log("Push subscription succeeded after service worker reset");
              break;
            } catch (resetError) {
              console.warn("Retry after service worker reset failed:", resetError);
            }
          }

          throw e;
        }
      }

      if (!subscription) {
        console.error("All push subscription attempts failed");
        toast.error(
          "Push service rejected the subscription. This can be intermittent (browser push backend) or happen after VAPID key changes. Try again in a minute.",
          { duration: 7000 }
        );
        return false;
      }

      console.log("Push subscription created:", subscription.endpoint);

      // Save subscription to database
      const { error } = await saveSubscription(user.id, subscription);
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

        // Some browsers end up creating a subscription even when subscribe() throws.
        if (error.name === "AbortError" || error.name === "InvalidStateError") {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const userId = session?.user?.id;

            if (userId) {
              const reg = await navigator.serviceWorker.ready;
              const sub = await reg.pushManager.getSubscription();
              if (sub) {
                const { error: saveError } = await supabase
                  .from("push_subscriptions")
                  .upsert(
                    {
                      user_id: userId,
                      endpoint: sub.endpoint,
                      p256dh_key: sub.toJSON().keys?.p256dh || "",
                      auth_key: sub.toJSON().keys?.auth || "",
                    },
                    { onConflict: "user_id,endpoint" }
                  );

                if (!saveError) {
                  setIsPushSubscribed(true);
                  toast.success("Push notifications enabled!");
                  return true;
                }
              }
            }
          } catch (syncError) {
            console.warn("Failed to sync push subscription after error:", syncError);
          }
        }

        if (error.name === "AbortError") {
          if (isCapacitorNative()) {
            toast.error("Web Push isn't supported inside the native app. Use installable web app (PWA) for Web Push, or set up native push (Firebase).");
            return false;
          }
          
          // AbortError with "push service error" means the browser's push backend rejected this subscribe call.
          // HTTPS is required but not sufficient (incognito, privacy browsers, blocked push services, or stale SW state can still cause this).
          console.error("AbortError indicates push backend rejection. Common causes:");
          console.error("- Browser/policy blocking push (incognito, Brave shields, enterprise policy)");
          console.error("- Push backend intermittently unavailable");
          console.error("- Stale service worker/subscription state after key/app updates");

          toast.error(
            "Push service rejected the subscription. Even on HTTPS this can happen if the browser blocks push or the push backend is unavailable. Try again, or clear this site's data and re-enable.",
            { duration: 9000 }
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
  };

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (isProcessingPush) {
      console.log("Push operation already in progress");
      return false;
    }
    isProcessingPush = true;

    try {
      // Fall back to the ready registration in case this hook instance mounted before registration finished.
      const registration = swRegistrationRef.current ?? (await navigator.serviceWorker.ready);

      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();

        // Remove from database
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", subscription.endpoint);
        }
      }

      setIsPushSubscribed(false);
      toast.success("Push notifications disabled");
      return true;
    } catch (error) {
      console.error("Error unsubscribing from push:", error);
      toast.error("Failed to disable push notifications");
      return false;
    } finally {
      isProcessingPush = false;
    }
  }, []);

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
