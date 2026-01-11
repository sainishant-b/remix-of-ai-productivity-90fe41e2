-- Add email notification preferences to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS email_frequency text NOT NULL DEFAULT 'daily',
ADD COLUMN IF NOT EXISTS email_recommendations boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_overdue_alerts boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_weekly_reports boolean NOT NULL DEFAULT true;