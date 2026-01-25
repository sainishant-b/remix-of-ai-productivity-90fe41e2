import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NotificationPreferences {
  id?: string;
  user_id?: string;
  frequency_multiplier: number;
  minimum_lead_time: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  high_priority_enabled: boolean;
  medium_priority_enabled: boolean;
  low_priority_enabled: boolean;
  overdue_reminders_enabled: boolean;
  due_today_reminders_enabled: boolean;
  upcoming_reminders_enabled: boolean;
  daily_summary_enabled: boolean;
  custom_reminder_times: number[];
  peak_energy_time: string;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  frequency_multiplier: 1.0,
  minimum_lead_time: 5,
  quiet_hours_enabled: true,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  high_priority_enabled: true,
  medium_priority_enabled: true,
  low_priority_enabled: false,
  overdue_reminders_enabled: true,
  due_today_reminders_enabled: true,
  upcoming_reminders_enabled: true,
  daily_summary_enabled: true,
  custom_reminder_times: [15, 60, 1440], // 15min, 1hr, 1 day
  peak_energy_time: "morning",
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      setUserId(user.id);

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 means no rows found, which is fine for first-time users
        console.error("Error loading notification preferences:", error);
      }

      if (data) {
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...data,
          quiet_hours_start: data.quiet_hours_start?.slice(0, 5) || "22:00",
          quiet_hours_end: data.quiet_hours_end?.slice(0, 5) || "07:00",
        });
      }
      
      setIsLoading(false);
    };

    loadPreferences();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadPreferences();
      } else {
        setUserId(null);
        setPreferences(DEFAULT_PREFERENCES);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Update a single preference
  const updatePreference = useCallback(async <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    if (!userId) return;

    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    // Optimistic update - then sync to database
    await saveToDatabase(newPreferences);
  }, [preferences, userId]);

  // Update multiple preferences at once
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!userId) return;

    const newPreferences = { ...preferences, ...updates };
    setPreferences(newPreferences);

    await saveToDatabase(newPreferences);
  }, [preferences, userId]);

  // Save to database (upsert)
  const saveToDatabase = useCallback(async (prefs: NotificationPreferences) => {
    if (!userId) return;
    
    setIsSaving(true);

    // Format times for database (add seconds)
    const dbPrefs = {
      user_id: userId,
      frequency_multiplier: prefs.frequency_multiplier,
      minimum_lead_time: prefs.minimum_lead_time,
      quiet_hours_enabled: prefs.quiet_hours_enabled,
      quiet_hours_start: prefs.quiet_hours_start.includes(":") && prefs.quiet_hours_start.length === 5 
        ? `${prefs.quiet_hours_start}:00` 
        : prefs.quiet_hours_start,
      quiet_hours_end: prefs.quiet_hours_end.includes(":") && prefs.quiet_hours_end.length === 5 
        ? `${prefs.quiet_hours_end}:00` 
        : prefs.quiet_hours_end,
      high_priority_enabled: prefs.high_priority_enabled,
      medium_priority_enabled: prefs.medium_priority_enabled,
      low_priority_enabled: prefs.low_priority_enabled,
      overdue_reminders_enabled: prefs.overdue_reminders_enabled,
      due_today_reminders_enabled: prefs.due_today_reminders_enabled,
      upcoming_reminders_enabled: prefs.upcoming_reminders_enabled,
      daily_summary_enabled: prefs.daily_summary_enabled,
      custom_reminder_times: prefs.custom_reminder_times,
      peak_energy_time: prefs.peak_energy_time,
    };

    const { error } = await supabase
      .from("notification_preferences")
      .upsert(dbPrefs, { onConflict: "user_id" });

    if (error) {
      console.error("Error saving notification preferences:", error);
      toast.error("Failed to save notification preferences");
    }

    setIsSaving(false);
  }, [userId]);

  // Convert to the format expected by the decision engine
  const toDecisionEngineFormat = useCallback(() => {
    const disabledPriorities: ('high' | 'medium' | 'low')[] = [];
    if (!preferences.high_priority_enabled) disabledPriorities.push('high');
    if (!preferences.medium_priority_enabled) disabledPriorities.push('medium');
    if (!preferences.low_priority_enabled) disabledPriorities.push('low');

    return {
      frequencyMultiplier: preferences.frequency_multiplier,
      minimumLeadTime: preferences.minimum_lead_time,
      disabledPriorities,
      quietHoursStart: preferences.quiet_hours_start,
      quietHoursEnd: preferences.quiet_hours_end,
    };
  }, [preferences]);

  return {
    preferences,
    isLoading,
    isSaving,
    updatePreference,
    updatePreferences,
    toDecisionEngineFormat,
  };
}
