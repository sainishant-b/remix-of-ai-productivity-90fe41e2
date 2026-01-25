-- Create notification_preferences table for user-specific notification schedules
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  
  -- Timing preferences
  frequency_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0, -- 0.5 = less, 1 = normal, 2 = more aggressive
  minimum_lead_time INTEGER NOT NULL DEFAULT 5, -- Minutes before task to notify
  
  -- Quiet hours
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00:00',
  
  -- Priority preferences
  high_priority_enabled BOOLEAN NOT NULL DEFAULT true,
  medium_priority_enabled BOOLEAN NOT NULL DEFAULT true,
  low_priority_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Notification types
  overdue_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  due_today_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  upcoming_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Custom reminder times (stored as array of minutes before due)
  custom_reminder_times INTEGER[] DEFAULT ARRAY[15, 60, 1440], -- 15min, 1hr, 1 day
  
  -- Peak energy preference for smart scheduling
  peak_energy_time TEXT NOT NULL DEFAULT 'morning', -- morning, afternoon, evening
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own notification preferences" 
ON public.notification_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own notification preferences" 
ON public.notification_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences" 
ON public.notification_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();