/**
 * Intelligent Notification Decision Engine
 * Evaluates tasks and returns optimal notification schedules based on:
 * - Priority level
 * - Due date/time specificity
 * - Task duration
 * - Task category
 * - User energy patterns
 */

interface Task {
  id: string;
  title: string;
  due_date?: string | null;
  status: string;
  priority: string;
  estimated_duration?: number | null;
  category?: string;
}

interface UserProfile {
  work_hours_start: string;
  work_hours_end: string;
  peak_energy_time?: string; // e.g., "morning", "afternoon", "evening"
}

export interface ScheduledNotificationTime {
  time: Date;
  reason: string;
  type: 'advance-notice' | 'reminder' | 'final-reminder' | 'overdue' | 'daily-summary';
  priority: 'high' | 'medium' | 'low';
}

export interface NotificationSchedule {
  taskId: string;
  taskTitle: string;
  notifications: ScheduledNotificationTime[];
}

/**
 * Determines if a due date includes a specific time (not just midnight)
 */
function hasSpecificTime(dueDate: Date): boolean {
  const hours = dueDate.getHours();
  const minutes = dueDate.getMinutes();
  // If time is exactly midnight, likely just a date without specific time
  return !(hours === 0 && minutes === 0);
}

/**
 * Gets the user's peak energy hours based on preference
 */
function getPeakEnergyHours(preference?: string): { start: number; end: number } {
  switch (preference) {
    case 'morning':
      return { start: 8, end: 12 };
    case 'afternoon':
      return { start: 12, end: 17 };
    case 'evening':
      return { start: 17, end: 21 };
    default:
      return { start: 9, end: 12 }; // Default to morning
  }
}

/**
 * Gets appropriate notification lead times based on task duration
 */
function getLeadTimeForDuration(durationMinutes: number | null | undefined): number {
  if (!durationMinutes) return 15; // Default 15 min
  
  if (durationMinutes >= 120) {
    // Long tasks (2+ hours): 30 min lead time
    return 30;
  } else if (durationMinutes >= 60) {
    // Medium tasks (1-2 hours): 20 min lead time
    return 20;
  } else if (durationMinutes <= 30) {
    // Short tasks: 10 min lead time
    return 10;
  }
  return 15;
}

/**
 * Checks if a time falls within work hours
 */
function isWithinWorkHours(date: Date, profile: UserProfile): boolean {
  const [startHour, startMin] = profile.work_hours_start.split(':').map(Number);
  const [endHour, endMin] = profile.work_hours_end.split(':').map(Number);
  
  const hour = date.getHours();
  const minute = date.getMinutes();
  const timeValue = hour * 60 + minute;
  const startValue = startHour * 60 + startMin;
  const endValue = endHour * 60 + endMin;
  
  return timeValue >= startValue && timeValue <= endValue;
}

/**
 * Adjusts notification time to fit within work hours for work tasks
 */
function adjustToWorkHours(date: Date, profile: UserProfile, isWorkTask: boolean): Date {
  if (!isWorkTask) return date;
  
  const [startHour, startMin] = profile.work_hours_start.split(':').map(Number);
  const [endHour, endMin] = profile.work_hours_end.split(':').map(Number);
  
  const adjusted = new Date(date);
  const hour = adjusted.getHours();
  
  if (hour < startHour) {
    adjusted.setHours(startHour, startMin, 0, 0);
  } else if (hour > endHour) {
    adjusted.setHours(endHour, endMin, 0, 0);
  }
  
  return adjusted;
}

/**
 * Main decision engine: Calculates notification schedule for a task
 */
export function calculateNotificationSchedule(
  task: Task,
  profile: UserProfile,
  existingOverdueReminders: number = 0
): NotificationSchedule {
  const notifications: ScheduledNotificationTime[] = [];
  const now = new Date();
  const isWorkTask = task.category === 'work';
  
  // No notifications for completed tasks
  if (task.status === 'completed') {
    return { taskId: task.id, taskTitle: task.title, notifications: [] };
  }

  // LOW PRIORITY: No automatic notifications
  if (task.priority === 'low') {
    return { taskId: task.id, taskTitle: task.title, notifications: [] };
  }

  // No due date handling
  if (!task.due_date) {
    // High priority without deadline: Include in daily AI recommendations
    if (task.priority === 'high') {
      const peakHours = getPeakEnergyHours(profile.peak_energy_time);
      const reminderTime = new Date(now);
      reminderTime.setDate(reminderTime.getDate() + 1);
      reminderTime.setHours(peakHours.start, 0, 0, 0);
      
      if (isWorkTask) {
        const adjustedTime = adjustToWorkHours(reminderTime, profile, true);
        if (adjustedTime > now) {
          notifications.push({
            time: adjustedTime,
            reason: 'High priority task without deadline - peak energy reminder',
            type: 'daily-summary',
            priority: 'high',
          });
        }
      }
    }
    // Medium priority without deadline: No automatic notifications
    return { taskId: task.id, taskTitle: task.title, notifications };
  }

  const dueDate = new Date(task.due_date);
  const dueDateStart = new Date(dueDate);
  dueDateStart.setHours(0, 0, 0, 0);
  
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  
  const isOverdue = dueDateStart < todayStart;
  const isDueToday = dueDateStart.getTime() === todayStart.getTime();
  const specificTime = hasSpecificTime(dueDate);

  // OVERDUE TASK HANDLING
  if (isOverdue) {
    if (task.priority === 'high') {
      // High priority overdue: Every 4 hours, max 3 per day
      if (existingOverdueReminders < 3) {
        const nextReminder = new Date(now);
        nextReminder.setHours(nextReminder.getHours() + 4);
        
        // Adjust to work hours for work tasks
        const adjustedReminder = adjustToWorkHours(nextReminder, profile, isWorkTask);
        
        if (adjustedReminder > now) {
          notifications.push({
            time: adjustedReminder,
            reason: `Overdue high priority - reminder ${existingOverdueReminders + 1} of 3`,
            type: 'overdue',
            priority: 'high',
          });
        }
      }
    } else if (task.priority === 'medium') {
      // Medium priority overdue: One reminder per day at 9am
      const reminderTime = new Date(now);
      reminderTime.setHours(9, 0, 0, 0);
      
      if (reminderTime <= now) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }
      
      notifications.push({
        time: reminderTime,
        reason: 'Overdue medium priority - daily reminder',
        type: 'overdue',
        priority: 'medium',
      });
    }
    
    return { taskId: task.id, taskTitle: task.title, notifications };
  }

  // HIGH PRIORITY NOTIFICATIONS
  if (task.priority === 'high') {
    const leadTime = getLeadTimeForDuration(task.estimated_duration);
    
    if (specificTime) {
      // Task WITH specific time
      
      // 1. 24 hours before
      const twentyFourHoursBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
      if (twentyFourHoursBefore > now) {
        const adjusted = adjustToWorkHours(twentyFourHoursBefore, profile, isWorkTask);
        notifications.push({
          time: adjusted,
          reason: '24hr advance notice for high priority',
          type: 'advance-notice',
          priority: 'high',
        });
      }
      
      // 2. 2 hours before
      const twoHoursBefore = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
      if (twoHoursBefore > now) {
        const adjusted = adjustToWorkHours(twoHoursBefore, profile, isWorkTask);
        notifications.push({
          time: adjusted,
          reason: '2hr reminder before scheduled time',
          type: 'reminder',
          priority: 'high',
        });
      }
      
      // 3. 15 min (or adjusted for duration) before
      const finalReminder = new Date(dueDate.getTime() - leadTime * 60 * 1000);
      if (finalReminder > now) {
        notifications.push({
          time: finalReminder,
          reason: `${leadTime}min final reminder`,
          type: 'final-reminder',
          priority: 'high',
        });
      }
    } else {
      // Task WITH date only (no specific time)
      // High: Notify at 9am, 2pm, 6pm on that day
      const times = [
        { hour: 9, minute: 0, label: 'morning' },
        { hour: 14, minute: 0, label: 'afternoon' },
        { hour: 18, minute: 0, label: 'evening' },
      ];
      
      for (const { hour, minute, label } of times) {
        const notifTime = new Date(dueDate);
        notifTime.setHours(hour, minute, 0, 0);
        
        if (notifTime > now) {
          const adjusted = adjustToWorkHours(notifTime, profile, isWorkTask);
          // Only add if still in future after adjustment
          if (adjusted > now) {
            notifications.push({
              time: adjusted,
              reason: `High priority due date - ${label} reminder`,
              type: 'reminder',
              priority: 'high',
            });
          }
        }
      }
      
      // Also add 24hr advance if due date is tomorrow or later
      const twentyFourHoursBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
      twentyFourHoursBefore.setHours(9, 0, 0, 0);
      if (twentyFourHoursBefore > now && !isDueToday) {
        notifications.push({
          time: twentyFourHoursBefore,
          reason: '24hr advance notice for high priority',
          type: 'advance-notice',
          priority: 'high',
        });
      }
    }
  }

  // MEDIUM PRIORITY NOTIFICATIONS
  if (task.priority === 'medium') {
    if (specificTime) {
      // Task WITH specific time: Single notification 2 hours before
      const twoHoursBefore = new Date(dueDate.getTime() - 2 * 60 * 60 * 1000);
      if (twoHoursBefore > now) {
        const adjusted = adjustToWorkHours(twoHoursBefore, profile, isWorkTask);
        notifications.push({
          time: adjusted,
          reason: '2hr reminder for medium priority task',
          type: 'reminder',
          priority: 'medium',
        });
      }
    } else {
      // Task WITH date only: One reminder at 9am on due date
      const reminderTime = new Date(dueDate);
      reminderTime.setHours(9, 0, 0, 0);
      
      if (reminderTime > now) {
        const adjusted = adjustToWorkHours(reminderTime, profile, isWorkTask);
        if (adjusted > now) {
          notifications.push({
            time: adjusted,
            reason: 'Medium priority due date - morning reminder',
            type: 'reminder',
            priority: 'medium',
          });
        }
      }
    }
  }

  // Sort notifications by time
  notifications.sort((a, b) => a.time.getTime() - b.time.getTime());

  return { taskId: task.id, taskTitle: task.title, notifications };
}

/**
 * Batch calculate notification schedules for multiple tasks
 */
export function calculateAllNotificationSchedules(
  tasks: Task[],
  profile: UserProfile,
  overdueReminderCounts: Record<string, number> = {}
): NotificationSchedule[] {
  return tasks
    .filter(task => task.status !== 'completed')
    .map(task => calculateNotificationSchedule(
      task, 
      profile, 
      overdueReminderCounts[task.id] || 0
    ))
    .filter(schedule => schedule.notifications.length > 0);
}

/**
 * Get a summary of notifications to be scheduled
 */
export function getNotificationSummary(schedules: NotificationSchedule[]): {
  total: number;
  byPriority: { high: number; medium: number; low: number };
  byType: Record<string, number>;
} {
  const summary = {
    total: 0,
    byPriority: { high: 0, medium: 0, low: 0 },
    byType: {} as Record<string, number>,
  };

  for (const schedule of schedules) {
    for (const notif of schedule.notifications) {
      summary.total++;
      summary.byPriority[notif.priority]++;
      summary.byType[notif.type] = (summary.byType[notif.type] || 0) + 1;
    }
  }

  return summary;
}
