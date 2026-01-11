import { useCallback, useEffect, useRef } from "react";
import { useLocalNotifications, ScheduledNotification } from "./useLocalNotifications";
import { supabase } from "@/integrations/supabase/client";
import { 
  calculateNotificationSchedule, 
  calculateAllNotificationSchedules,
  getNotificationSummary,
  NotificationSchedule,
  ScheduledNotificationTime 
} from "@/utils/notificationDecisionEngine";

interface Task {
  id: string;
  title: string;
  due_date?: string | null;
  status: string;
  priority: string;
  estimated_duration?: number | null;
  category?: string;
}

interface Profile {
  work_hours_start: string;
  work_hours_end: string;
  check_in_frequency: number;
}

interface RecommendedTask {
  taskId: string;
  title: string;
  suggestedTime: string;
  suggestedDate: string;
  reasoning: string;
  priority: string;
}

interface UseNotificationSchedulerOptions {
  profile: Profile | null;
  tasks: Task[];
  enabled?: boolean;
}

export const useNotificationScheduler = ({
  profile,
  tasks,
  enabled = true,
}: UseNotificationSchedulerOptions) => {
  const {
    isNative,
    hasPermission,
    settings,
    scheduleNotification,
    scheduleMultipleNotifications,
    cancelNotification,
    cancelNotificationsByType,
    refreshPendingNotifications,
  } = useLocalNotifications();

  const scheduledTaskIdsRef = useRef<Set<string>>(new Set());
  const lastCheckInScheduleRef = useRef<string | null>(null);
  const dailyNotificationScheduledRef = useRef<string | null>(null);

  // Schedule check-in reminders based on profile settings
  const scheduleCheckInReminders = useCallback(async () => {
    if (!profile || !enabled || !hasPermission) return;

    const scheduleKey = `${profile.work_hours_start}-${profile.work_hours_end}-${profile.check_in_frequency}`;
    if (lastCheckInScheduleRef.current === scheduleKey) return;

    // Cancel existing check-in notifications
    await cancelNotificationsByType('check-in');

    const now = new Date();
    const [startHour, startMin] = profile.work_hours_start.split(':').map(Number);
    const [endHour, endMin] = profile.work_hours_end.split(':').map(Number);

    const workStart = new Date(now);
    workStart.setHours(startHour, startMin, 0, 0);

    const workEnd = new Date(now);
    workEnd.setHours(endHour, endMin, 0, 0);

    // Calculate interval between check-ins
    const workDurationMs = workEnd.getTime() - workStart.getTime();
    const intervalMs = workDurationMs / profile.check_in_frequency;

    const notifications: Omit<ScheduledNotification, 'id'>[] = [];

    // Schedule for next 7 days
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayStart = new Date(workStart);
      dayStart.setDate(dayStart.getDate() + dayOffset);

      const dayEnd = new Date(workEnd);
      dayEnd.setDate(dayEnd.getDate() + dayOffset);

      for (let i = 0; i < profile.check_in_frequency; i++) {
        const checkInTime = new Date(dayStart.getTime() + intervalMs * i);
        
        // Skip past times
        if (checkInTime <= now) continue;

        notifications.push({
          title: "Time for a check-in! ✨",
          body: "How's your energy and mood right now?",
          scheduleAt: checkInTime,
          type: 'check-in',
          data: { type: 'check-in' },
        });
      }
    }

    await scheduleMultipleNotifications(notifications);
    lastCheckInScheduleRef.current = scheduleKey;
    
    console.log(`Scheduled ${notifications.length} check-in reminders`);
  }, [profile, enabled, hasPermission, cancelNotificationsByType, scheduleMultipleNotifications]);

  // Track overdue reminder counts per task (max 3 per day for high priority)
  const overdueReminderCountsRef = useRef<Record<string, number>>({});
  const lastSmartScheduleRef = useRef<string | null>(null);

  // Schedule task reminders using the smart notification decision engine
  const scheduleSmartTaskNotifications = useCallback(async () => {
    if (!enabled || !hasPermission || !profile) return;

    // Create a schedule key to prevent duplicate scheduling
    const scheduleKey = tasks
      .filter(t => t.status !== 'completed')
      .map(t => `${t.id}-${t.due_date}-${t.priority}`)
      .join('|');
    
    if (lastSmartScheduleRef.current === scheduleKey) return;

    // Cancel existing task notifications
    await cancelNotificationsByType('task-reminder');
    await cancelNotificationsByType('advance-notice');
    await cancelNotificationsByType('overdue');
    await cancelNotificationsByType('final-reminder');

    // Calculate notification schedules for all tasks
    const schedules = calculateAllNotificationSchedules(
      tasks,
      {
        work_hours_start: profile.work_hours_start,
        work_hours_end: profile.work_hours_end,
      },
      overdueReminderCountsRef.current
    );

    const summary = getNotificationSummary(schedules);
    console.log(`Smart notifications summary:`, summary);

    const allNotifications: Omit<ScheduledNotification, 'id'>[] = [];

    for (const schedule of schedules) {
      for (const notif of schedule.notifications) {
        // Skip if already scheduled this task
        if (scheduledTaskIdsRef.current.has(`${schedule.taskId}-${notif.type}-${notif.time.getTime()}`)) {
          continue;
        }

        // Build notification content based on type
        let title = '';
        let body = '';
        const priorityEmoji = notif.priority === 'high' ? '🔴' : 
                             notif.priority === 'medium' ? '🟡' : '🟢';

        switch (notif.type) {
          case 'advance-notice':
            title = `📅 Upcoming: ${schedule.taskTitle}`;
            body = `${priorityEmoji} ${notif.reason}`;
            break;
          case 'reminder':
            title = `⏰ Reminder: ${schedule.taskTitle}`;
            body = `${priorityEmoji} ${notif.reason}`;
            break;
          case 'final-reminder':
            title = `🚨 Starting Soon: ${schedule.taskTitle}`;
            body = `${priorityEmoji} ${notif.reason}`;
            break;
          case 'overdue':
            title = `⚠️ Overdue: ${schedule.taskTitle}`;
            body = `${priorityEmoji} ${notif.reason}`;
            // Track overdue reminder count
            overdueReminderCountsRef.current[schedule.taskId] = 
              (overdueReminderCountsRef.current[schedule.taskId] || 0) + 1;
            break;
          case 'daily-summary':
            title = `🎯 High Priority: ${schedule.taskTitle}`;
            body = `${priorityEmoji} Consider tackling this during your peak energy time`;
            break;
          default:
            title = `📌 ${schedule.taskTitle}`;
            body = notif.reason;
        }

        allNotifications.push({
          title,
          body,
          scheduleAt: notif.time,
          type: notif.type as any,
          data: { 
            type: 'task-reminder', 
            taskId: schedule.taskId,
            notificationType: notif.type,
          },
        });

        scheduledTaskIdsRef.current.add(`${schedule.taskId}-${notif.type}-${notif.time.getTime()}`);
      }
    }

    // Schedule all notifications at once
    if (allNotifications.length > 0) {
      await scheduleMultipleNotifications(allNotifications);
      console.log(`Scheduled ${allNotifications.length} smart task notifications`);
    }

    lastSmartScheduleRef.current = scheduleKey;
  }, [tasks, profile, enabled, hasPermission, cancelNotificationsByType, scheduleMultipleNotifications]);

  // Legacy function for backward compatibility
  const scheduleTaskReminders = useCallback(async () => {
    // Delegate to smart scheduling
    await scheduleSmartTaskNotifications();
  }, [scheduleSmartTaskNotifications]);

  // Cancel notification for a specific task (when completed or rescheduled)
  const cancelTaskReminder = useCallback(async (taskId: string) => {
    scheduledTaskIdsRef.current.delete(taskId);
    // Note: The actual cancellation would need the notification ID
    // For now, this marks it as not scheduled so it can be rescheduled
  }, []);

  // Schedule daily AI recommendation notification
  const scheduleDailyAINotification = useCallback(async () => {
    if (!enabled || !hasPermission) return;

    const today = new Date().toDateString();
    if (dailyNotificationScheduledRef.current === today) return;

    // Cancel existing AI notifications
    await cancelNotificationsByType('ai-recommendation');

    const now = new Date();
    const notificationTime = new Date(now);
    
    // Schedule for 8 AM if not past, otherwise schedule for tomorrow
    notificationTime.setHours(8, 0, 0, 0);
    if (notificationTime <= now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    // Check if there are uncompleted tasks
    const uncompletedTasks = tasks.filter(t => t.status !== 'completed');
    if (uncompletedTasks.length === 0) {
      console.log("No uncompleted tasks, skipping AI notification");
      return;
    }

    await scheduleNotification({
      title: "Your Daily Task Recommendations 🎯",
      body: `We've prepared ${Math.min(uncompletedTasks.length, 5)} tasks matched to your energy levels`,
      scheduleAt: notificationTime,
      type: 'ai-recommendation',
      data: { type: 'ai-recommendation' },
    });

    dailyNotificationScheduledRef.current = today;
    console.log("Scheduled daily AI recommendation notification");
  }, [enabled, hasPermission, tasks, cancelNotificationsByType, scheduleNotification]);

  // Schedule overdue task alerts
  const scheduleOverdueAlerts = useCallback(async () => {
    if (!enabled || !hasPermission) return;

    // Cancel existing overdue notifications
    await cancelNotificationsByType('overdue-alert');

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Check for overdue tasks
    const overdueTasks = tasks.filter(task => {
      if (task.status === 'completed' || !task.due_date) return false;
      const dueDate = new Date(task.due_date);
      const dueDateStart = new Date(dueDate);
      dueDateStart.setHours(0, 0, 0, 0);
      return dueDateStart < todayStart;
    });

    if (overdueTasks.length === 0) return;

    // Count high priority overdue
    const highPriorityCount = overdueTasks.filter(t => t.priority === 'high').length;

    // Schedule for 9 AM
    const notificationTime = new Date(now);
    notificationTime.setHours(9, 0, 0, 0);
    if (notificationTime <= now) {
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    const body = highPriorityCount > 0
      ? `You have ${highPriorityCount} overdue high-priority task${highPriorityCount > 1 ? 's' : ''}`
      : `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}`;

    await scheduleNotification({
      title: `⚠️ ${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} need attention`,
      body,
      scheduleAt: notificationTime,
      type: 'overdue-alert',
      data: { type: 'overdue-alert' },
    });

    console.log("Scheduled overdue alert notification");
  }, [enabled, hasPermission, tasks, cancelNotificationsByType, scheduleNotification]);

  // Schedule smart task reminders from AI recommendations
  const scheduleSmartTaskReminders = useCallback(async (recommendations: RecommendedTask[]) => {
    if (!enabled || !hasPermission || !settings.smartTaskReminders) return;

    const now = new Date();
    const today = now.toDateString();
    const leadTimeMinutes = settings.reminderLeadTime;

    // Get already dismissed smart reminders for today
    const dismissedKey = `dismissedSmartReminders-${today}`;
    const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || '[]'));

    const scheduledIds: number[] = [];

    for (const rec of recommendations.slice(0, 5)) {
      // Skip if already dismissed today
      if (dismissed.has(rec.taskId)) continue;

      // Parse suggested time (e.g., "10:00 AM - 12:00 PM" or "10:00 AM")
      const timeMatch = rec.suggestedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (!timeMatch) continue;

      let hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      const ampm = timeMatch[3]?.toUpperCase();

      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;

      const suggestedDate = new Date(rec.suggestedDate || today);
      suggestedDate.setHours(hour, minute, 0, 0);

      // Only schedule for today
      if (suggestedDate.toDateString() !== today) continue;

      // Calculate reminder time (before suggested time)
      const reminderTime = new Date(suggestedDate.getTime() - leadTimeMinutes * 60 * 1000);

      // Skip past times
      if (reminderTime <= now) continue;

      // Truncate reasoning for notification body
      const reasoning = rec.reasoning.length > 60 
        ? rec.reasoning.substring(0, 57) + '...' 
        : rec.reasoning;

      const id = await scheduleNotification({
        title: `🎯 Recommended Now: ${rec.title}`,
        body: `${rec.suggestedTime} • ${reasoning}`,
        scheduleAt: reminderTime,
        type: 'smart-task',
        data: { 
          type: 'smart-task', 
          taskId: rec.taskId,
          suggestedTime: rec.suggestedTime,
        },
      });

      if (id) scheduledIds.push(id);
    }

    console.log(`Scheduled ${scheduledIds.length} smart task reminders`);
    return scheduledIds;
  }, [enabled, hasPermission, settings.smartTaskReminders, settings.reminderLeadTime, scheduleNotification]);

  // Dismiss a smart reminder (won't re-notify today)
  const dismissSmartReminder = useCallback((taskId: string) => {
    const today = new Date().toDateString();
    const dismissedKey = `dismissedSmartReminders-${today}`;
    const dismissed = JSON.parse(localStorage.getItem(dismissedKey) || '[]');
    dismissed.push(taskId);
    localStorage.setItem(dismissedKey, JSON.stringify(dismissed));
  }, []);

  // Initialize and reschedule on app startup
  useEffect(() => {
    if (!enabled || !hasPermission) return;

    const initializeNotifications = async () => {
      console.log("Initializing notification scheduler...");
      await refreshPendingNotifications();
      await scheduleCheckInReminders();
      await scheduleTaskReminders();
      await scheduleDailyAINotification();
      await scheduleOverdueAlerts();
    };

    initializeNotifications();
  }, [
    enabled, 
    hasPermission, 
    refreshPendingNotifications,
    scheduleCheckInReminders, 
    scheduleTaskReminders, 
    scheduleDailyAINotification,
    scheduleOverdueAlerts,
  ]);

  // Reschedule check-ins when profile changes
  useEffect(() => {
    if (profile && enabled && hasPermission) {
      scheduleCheckInReminders();
    }
  }, [profile, enabled, hasPermission, scheduleCheckInReminders]);

  // Reschedule task reminders when tasks change
  useEffect(() => {
    if (tasks.length > 0 && enabled && hasPermission) {
      scheduleTaskReminders();
      scheduleOverdueAlerts();
    }
  }, [tasks, enabled, hasPermission, scheduleTaskReminders, scheduleOverdueAlerts]);

  return {
    scheduleCheckInReminders,
    scheduleTaskReminders,
    scheduleSmartTaskNotifications,
    scheduleDailyAINotification,
    scheduleOverdueAlerts,
    scheduleSmartTaskReminders,
    cancelTaskReminder,
    dismissSmartReminder,
    refreshPendingNotifications,
    // Export the decision engine functions for external use
    calculateScheduleForTask: (task: Task) => 
      profile ? calculateNotificationSchedule(task, {
        work_hours_start: profile.work_hours_start,
        work_hours_end: profile.work_hours_end,
      }) : null,
    getNotificationSummary: () => 
      profile ? getNotificationSummary(calculateAllNotificationSchedules(tasks, {
        work_hours_start: profile.work_hours_start,
        work_hours_end: profile.work_hours_end,
      })) : null,
  };
};
