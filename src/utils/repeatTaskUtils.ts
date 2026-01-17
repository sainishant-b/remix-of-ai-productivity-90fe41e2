import { addDays, addWeeks, addMonths, addYears, setHours, setMinutes, isBefore, isAfter, getDay } from "date-fns";

export interface RepeatConfig {
  repeat_enabled: boolean;
  repeat_frequency: number;
  repeat_unit: "day" | "week" | "month" | "year";
  repeat_days_of_week: number[];
  repeat_times: string[];
  repeat_end_type: "never" | "on_date" | "after_count";
  repeat_end_date: string | null;
  repeat_end_count: number | null;
  repeat_completed_count?: number;
}

export interface TaskWithRepeat {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category: string;
  estimated_duration?: number;
  notes?: string;
  due_date?: string;
  user_id: string;
  progress?: number;
  repeat_enabled: boolean;
  repeat_frequency: number;
  repeat_unit: "day" | "week" | "month" | "year";
  repeat_days_of_week: number[];
  repeat_times: string[];
  repeat_end_type: "never" | "on_date" | "after_count";
  repeat_end_date: string | null;
  repeat_end_count: number | null;
  repeat_completed_count: number;
  repeat_parent_id: string | null;
  repeat_series_id: string | null;
}

/**
 * Calculate the next occurrence date for a repeating task
 */
export function calculateNextOccurrence(
  currentDate: Date,
  config: RepeatConfig
): Date | null {
  const { repeat_frequency, repeat_unit, repeat_days_of_week, repeat_times, repeat_end_type, repeat_end_date, repeat_end_count, repeat_completed_count } = config;

  // Check if we've hit the occurrence limit
  if (repeat_end_type === "after_count" && repeat_end_count !== null) {
    if ((repeat_completed_count || 0) >= repeat_end_count) {
      return null;
    }
  }

  let nextDate: Date;

  switch (repeat_unit) {
    case "day":
      nextDate = addDays(currentDate, repeat_frequency);
      break;
    case "week":
      if (repeat_days_of_week.length > 0) {
        // Find next matching day of week
        nextDate = findNextDayOfWeek(currentDate, repeat_days_of_week, repeat_frequency);
      } else {
        nextDate = addWeeks(currentDate, repeat_frequency);
      }
      break;
    case "month":
      nextDate = addMonths(currentDate, repeat_frequency);
      break;
    case "year":
      nextDate = addYears(currentDate, repeat_frequency);
      break;
    default:
      nextDate = addDays(currentDate, 1);
  }

  // Apply the first time if specified
  if (repeat_times && repeat_times.length > 0) {
    const [hours, minutes] = repeat_times[0].split(":").map(Number);
    nextDate = setHours(setMinutes(nextDate, minutes), hours);
  }

  // Check end date
  if (repeat_end_type === "on_date" && repeat_end_date) {
    const endDate = new Date(repeat_end_date);
    if (isAfter(nextDate, endDate)) {
      return null;
    }
  }

  return nextDate;
}

/**
 * Find the next occurrence on a specific day of week
 */
function findNextDayOfWeek(fromDate: Date, daysOfWeek: number[], frequencyInWeeks: number): Date {
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
  const currentDay = getDay(fromDate);
  
  // Find the next day in the same week
  for (const day of sortedDays) {
    if (day > currentDay) {
      return addDays(fromDate, day - currentDay);
    }
  }
  
  // Move to next week(s) and get the first day
  const daysUntilNextWeek = 7 - currentDay + sortedDays[0];
  const additionalWeeks = (frequencyInWeeks - 1) * 7;
  return addDays(fromDate, daysUntilNextWeek + additionalWeeks);
}

/**
 * Format repeat configuration for display
 */
export function formatRepeatDescription(config: RepeatConfig): string {
  if (!config.repeat_enabled) return "";

  const { repeat_frequency, repeat_unit, repeat_days_of_week, repeat_times, repeat_end_type, repeat_end_count } = config;

  let description = `Repeats every ${repeat_frequency > 1 ? repeat_frequency + " " : ""}${repeat_unit}${repeat_frequency > 1 ? "s" : ""}`;

  if (repeat_unit === "week" && repeat_days_of_week.length > 0) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = repeat_days_of_week.map((d) => dayNames[d]).join(", ");
    description += ` on ${days}`;
  }

  if (repeat_times && repeat_times.length > 0) {
    const formattedTimes = repeat_times.map((time) => {
      const [hours, minutes] = time.split(":");
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? "PM" : "AM";
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    });
    description += ` at ${formattedTimes.join(", ")}`;
  }

  if (repeat_end_type === "after_count" && repeat_end_count) {
    description += ` (${repeat_end_count} times)`;
  }

  return description;
}

/**
 * Create the next task occurrence
 */
export function createNextTaskData(
  completedTask: TaskWithRepeat,
  nextDueDate: Date
): Partial<TaskWithRepeat> {
  return {
    title: completedTask.title,
    description: completedTask.description,
    priority: completedTask.priority,
    status: "not_started",
    category: completedTask.category,
    estimated_duration: completedTask.estimated_duration,
    notes: completedTask.notes,
    due_date: nextDueDate.toISOString(),
    user_id: completedTask.user_id,
    progress: 0,
    repeat_enabled: completedTask.repeat_enabled,
    repeat_frequency: completedTask.repeat_frequency,
    repeat_unit: completedTask.repeat_unit,
    repeat_days_of_week: completedTask.repeat_days_of_week,
    repeat_times: completedTask.repeat_times,
    repeat_end_type: completedTask.repeat_end_type,
    repeat_end_date: completedTask.repeat_end_date,
    repeat_end_count: completedTask.repeat_end_count,
    repeat_completed_count: (completedTask.repeat_completed_count || 0) + 1,
    repeat_parent_id: completedTask.id,
    repeat_series_id: completedTask.repeat_series_id || completedTask.id,
  };
}

/**
 * Check if a task should generate the next occurrence
 */
export function shouldGenerateNextOccurrence(task: TaskWithRepeat): boolean {
  if (!task.repeat_enabled) return false;

  const config: RepeatConfig = {
    repeat_enabled: task.repeat_enabled,
    repeat_frequency: task.repeat_frequency,
    repeat_unit: task.repeat_unit,
    repeat_days_of_week: task.repeat_days_of_week || [],
    repeat_times: task.repeat_times || [],
    repeat_end_type: task.repeat_end_type,
    repeat_end_date: task.repeat_end_date,
    repeat_end_count: task.repeat_end_count,
    repeat_completed_count: task.repeat_completed_count,
  };

  const nextDate = calculateNextOccurrence(new Date(), config);
  return nextDate !== null;
}
