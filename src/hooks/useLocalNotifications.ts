import { useState, useEffect, useCallback, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications, LocalNotificationSchema, ScheduleOptions, PendingResult } from "@capacitor/local-notifications";
import { toast } from "sonner";

export interface ScheduledNotification {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
  type: 'check-in' | 'task-reminder' | 'ai-recommendation' | 'overdue-alert' | 'smart-task' | 'advance-notice' | 'overdue' | 'final-reminder' | 'daily-summary';
  data?: Record<string, unknown>;
}

interface NotificationSettings {
  checkInReminders: boolean;
  taskReminders: boolean;
  aiRecommendations: boolean;
  overdueAlerts: boolean;
  smartTaskReminders: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  reminderLeadTime: number; // minutes before task
}

const DEFAULT_SETTINGS: NotificationSettings = {
  checkInReminders: true,
  taskReminders: true,
  aiRecommendations: true,
  overdueAlerts: true,
  smartTaskReminders: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  reminderLeadTime: 15,
};

interface UseLocalNotificationsReturn {
  isNative: boolean;
  isSupported: boolean;
  hasPermission: boolean;
  settings: NotificationSettings;
  pendingNotifications: PendingResult | null;
  requestPermission: () => Promise<boolean>;
  scheduleNotification: (notification: Omit<ScheduledNotification, 'id'>) => Promise<number | null>;
  scheduleMultipleNotifications: (notifications: Omit<ScheduledNotification, 'id'>[]) => Promise<number[]>;
  cancelNotification: (id: number) => Promise<void>;
  cancelNotificationsByType: (type: ScheduledNotification['type']) => Promise<void>;
  cancelAllNotifications: () => Promise<void>;
  updateSettings: (newSettings: Partial<NotificationSettings>) => void;
  isInQuietHours: () => boolean;
  refreshPendingNotifications: () => Promise<void>;
}

// Generate consistent notification IDs based on type and data
const generateNotificationId = (type: string, identifier?: string): number => {
  const baseString = `${type}-${identifier || Date.now()}`;
  let hash = 0;
  for (let i = 0; i < baseString.length; i++) {
    const char = baseString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647; // Keep within int32 range
};

export const useLocalNotifications = (): UseLocalNotificationsReturn => {
  const [isNative] = useState(() => Capacitor.isNativePlatform());
  const [isSupported, setIsSupported] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [pendingNotifications, setPendingNotifications] = useState<PendingResult | null>(null);
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem("notificationSettings");
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });
  const listenerSetupRef = useRef(false);

  useEffect(() => {
    const checkSupport = async () => {
      if (!isNative) {
        // Web fallback - use browser notifications
        setIsSupported("Notification" in window);
        setHasPermission(Notification.permission === "granted");
        return;
      }

      try {
        const permStatus = await LocalNotifications.checkPermissions();
        setIsSupported(true);
        setHasPermission(permStatus.display === "granted");
      } catch (error) {
        console.error("Local notifications not supported:", error);
        setIsSupported(false);
      }
    };

    checkSupport();
  }, [isNative]);

  // Set up notification action listeners
  useEffect(() => {
    if (!isNative || listenerSetupRef.current) return;
    listenerSetupRef.current = true;

    const setupListeners = async () => {
      await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
        console.log("Local notification action:", action);
        
        const data = action.notification.extra;
        const actionId = action.actionId;
        
        // Handle notification tap
        if (actionId === "tap" || actionId === "view") {
          if (data?.type === "check-in") {
            window.dispatchEvent(new CustomEvent("open-checkin"));
          } else if ((data?.type === "task-reminder" || data?.type === "smart-task") && data?.taskId) {
            window.location.href = `/task/${data.taskId}`;
          } else if (data?.type === "ai-recommendation") {
            window.location.href = "/?tab=recommendations";
          } else if (data?.type === "overdue-alert") {
            window.location.href = "/?filter=overdue";
          }
        }
      });

      await LocalNotifications.addListener("localNotificationReceived", (notification) => {
        console.log("Local notification received:", notification);
        // On Android, foreground notifications may not show, so we display a toast
        if (Capacitor.getPlatform() === "android") {
          toast(notification.title || "Notification", {
            description: notification.body,
          });
        }
      });
    };

    setupListeners();

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, [isNative]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      // Web fallback
      if ("Notification" in window) {
        const result = await Notification.requestPermission();
        const granted = result === "granted";
        setHasPermission(granted);
        return granted;
      }
      return false;
    }

    try {
      const permStatus = await LocalNotifications.requestPermissions();
      const granted = permStatus.display === "granted";
      setHasPermission(granted);
      
      if (granted) {
        toast.success("Notification permissions granted!");
      } else {
        toast.error("Notification permissions denied");
      }
      
      return granted;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isNative]);

  const isInQuietHours = useCallback((): boolean => {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = settings.quietHoursStart.split(":").map(Number);
    const [endHour, endMin] = settings.quietHoursEnd.split(":").map(Number);
    
    const quietStart = startHour * 60 + startMin;
    const quietEnd = endHour * 60 + endMin;
    
    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime <= quietEnd;
    }
    
    return currentTime >= quietStart && currentTime <= quietEnd;
  }, [settings.quietHoursStart, settings.quietHoursEnd]);

  const scheduleNotification = useCallback(async (
    notification: Omit<ScheduledNotification, 'id'>
  ): Promise<number | null> => {
    // Check if this type is enabled
    const typeSettings: Record<ScheduledNotification['type'], keyof NotificationSettings> = {
      'check-in': 'checkInReminders',
      'task-reminder': 'taskReminders',
      'ai-recommendation': 'aiRecommendations',
      'overdue-alert': 'overdueAlerts',
      'smart-task': 'smartTaskReminders',
      'advance-notice': 'taskReminders',
      'overdue': 'overdueAlerts',
      'final-reminder': 'taskReminders',
      'daily-summary': 'aiRecommendations',
    };
    
    const settingKey = typeSettings[notification.type];
    if (!settings[settingKey]) {
      console.log(`Notification type ${notification.type} is disabled`);
      return null;
    }

    // Check quiet hours
    const scheduleTime = notification.scheduleAt;
    const scheduleHour = scheduleTime.getHours();
    const scheduleMin = scheduleTime.getMinutes();
    const scheduleTimeMinutes = scheduleHour * 60 + scheduleMin;
    
    const [qStartHour, qStartMin] = settings.quietHoursStart.split(":").map(Number);
    const [qEndHour, qEndMin] = settings.quietHoursEnd.split(":").map(Number);
    const quietStart = qStartHour * 60 + qStartMin;
    const quietEnd = qEndHour * 60 + qEndMin;
    
    const willBeInQuietHours = quietStart > quietEnd
      ? scheduleTimeMinutes >= quietStart || scheduleTimeMinutes <= quietEnd
      : scheduleTimeMinutes >= quietStart && scheduleTimeMinutes <= quietEnd;
    
    if (willBeInQuietHours) {
      console.log("Notification scheduled during quiet hours, skipping");
      return null;
    }

    const notificationId = generateNotificationId(
      notification.type, 
      (notification.data?.taskId as string) || notification.scheduleAt.toISOString()
    );

    if (!isNative) {
      // Web fallback using setTimeout
      const delay = notification.scheduleAt.getTime() - Date.now();
      if (delay > 0 && hasPermission) {
        setTimeout(() => {
          new Notification(notification.title, {
            body: notification.body,
            tag: `${notification.type}-${notificationId}`,
            data: notification.data,
          });
        }, delay);
        return notificationId;
      }
      return null;
    }

    try {
      const localNotif: LocalNotificationSchema = {
        id: notificationId,
        title: notification.title,
        body: notification.body,
        schedule: { at: notification.scheduleAt },
        sound: "default",
        extra: { ...notification.data, type: notification.type },
        actionTypeId: notification.type,
        smallIcon: "ic_launcher",
        iconColor: "#6366f1",
      };

      const options: ScheduleOptions = {
        notifications: [localNotif],
      };

      await LocalNotifications.schedule(options);
      console.log(`Scheduled notification ${notificationId}:`, notification.title);
      
      return notificationId;
    } catch (error) {
      console.error("Error scheduling notification:", error);
      return null;
    }
  }, [isNative, hasPermission, settings]);

  const scheduleMultipleNotifications = useCallback(async (
    notifications: Omit<ScheduledNotification, 'id'>[]
  ): Promise<number[]> => {
    const ids: number[] = [];
    
    for (const notification of notifications) {
      const id = await scheduleNotification(notification);
      if (id !== null) {
        ids.push(id);
      }
    }
    
    return ids;
  }, [scheduleNotification]);

  const cancelNotification = useCallback(async (id: number): Promise<void> => {
    if (!isNative) return;
    
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      console.log(`Cancelled notification ${id}`);
    } catch (error) {
      console.error("Error cancelling notification:", error);
    }
  }, [isNative]);

  const cancelNotificationsByType = useCallback(async (
    type: ScheduledNotification['type']
  ): Promise<void> => {
    if (!isNative) return;
    
    try {
      const pending = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => n.extra?.type === type);
      
      if (toCancel.length > 0) {
        await LocalNotifications.cancel({ 
          notifications: toCancel.map(n => ({ id: n.id }))
        });
        console.log(`Cancelled ${toCancel.length} notifications of type ${type}`);
      }
    } catch (error) {
      console.error("Error cancelling notifications by type:", error);
    }
  }, [isNative]);

  const cancelAllNotifications = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
      }
      console.log("Cancelled all notifications");
    } catch (error) {
      console.error("Error cancelling all notifications:", error);
    }
  }, [isNative]);

  const updateSettings = useCallback((newSettings: Partial<NotificationSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem("notificationSettings", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshPendingNotifications = useCallback(async (): Promise<void> => {
    if (!isNative) return;
    
    try {
      const pending = await LocalNotifications.getPending();
      setPendingNotifications(pending);
    } catch (error) {
      console.error("Error getting pending notifications:", error);
    }
  }, [isNative]);

  // Refresh pending on mount
  useEffect(() => {
    if (isNative && hasPermission) {
      refreshPendingNotifications();
    }
  }, [isNative, hasPermission, refreshPendingNotifications]);

  return {
    isNative,
    isSupported,
    hasPermission,
    settings,
    pendingNotifications,
    requestPermission,
    scheduleNotification,
    scheduleMultipleNotifications,
    cancelNotification,
    cancelNotificationsByType,
    cancelAllNotifications,
    updateSettings,
    isInQuietHours,
    refreshPendingNotifications,
  };
};
