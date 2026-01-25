# AI Productivity App - Project Context

## Overview
A productivity application for task management with intelligent notifications, work sessions, and AI-powered recommendations. Built with React, TypeScript, Tailwind CSS, and Lovable Cloud (Supabase).

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Backend**: Lovable Cloud (Supabase) - PostgreSQL, Edge Functions, Auth
- **Mobile**: Capacitor for Android/iOS hybrid apps
- **Notifications**: Web Push API + FCM for native push

---

## Current Features (Implemented)

### Authentication
- Email/password authentication via Supabase Auth
- User profiles with work hours, check-in frequency, streak tracking
- Auto-confirm email signups enabled

### Task Management
- CRUD operations for tasks with priority levels (high/medium/low)
- Task categories (work, personal, health, learning, other)
- Due dates with optional specific times
- Estimated duration tracking
- Progress tracking (0-100%)
- Subtasks support
- Task history logging

### Repeating Tasks
- Configurable repeat frequency (daily, weekly, monthly)
- Days of week selection
- Repeat end conditions (never, date, count)
- Streak tracking for habit-forming
- Completion heatmap visualization

### Work Sessions
- Timer-based work sessions linked to tasks
- Session notes
- Time spent tracking
- Active session detection

### Check-ins
- Periodic mood/energy check-ins
- Customizable check-in frequency
- Streak tracking for consistency
- Check-in modal with energy level and mood capture

### Notifications System

#### Local Notifications (Capacitor)
- Check-in reminders during work hours
- Task due reminders
- Overdue task alerts
- AI recommendation notifications
- Smart task reminders based on priority

#### Server Push Notifications (FCM)
- Edge function: `send-push-notification`
- Supports Web Push and FCM for Android
- Push subscription storage in database

#### Scheduled Notifications (Server-side)
- Edge function: `scheduled-notifications`
- Sends overdue alerts, daily summaries, check-in reminders
- Respects user work hours

#### User Notification Preferences (NEW)
- Database table: `notification_preferences`
- Customizable settings:
  - Frequency multiplier (0.5x to 2x)
  - Minimum lead time before tasks
  - Priority-based toggles (high/medium/low)
  - Custom reminder times (array of minutes before due)
  - Peak energy time preference
  - Quiet hours with enable/disable toggle

### AI Features
- Task recommendations via edge function
- Smart notification scheduling based on priority and energy patterns
- Recommendation caching

### Views/Pages
- **Dashboard** (`/`): Main task list with priority sections
- **Calendar** (`/calendar`): Calendar view of tasks
- **Insights** (`/insights`): Analytics and productivity insights
- **Settings** (`/settings`): User preferences and notification config
- **Task Workspace** (`/task/:id`): Focused task view with timer
- **Auth** (`/auth`): Login/signup page

### Mobile Support
- Capacitor integration for Android/iOS
- Status bar configuration
- Back button handling (Android)
- Safe area insets
- Bottom navigation for mobile
- Swipeable task cards

---

## Database Schema

### Tables
1. **profiles** - User settings (work hours, streaks, email prefs)
2. **tasks** - Task data with repeat config
3. **subtasks** - Task subtasks
4. **task_history** - Change log for tasks
5. **work_sessions** - Timer session records
6. **check_ins** - User check-in responses
7. **repeat_completions** - Tracking repeat task completions
8. **push_subscriptions** - Web push/FCM subscriptions
9. **notification_preferences** - User notification schedules (NEW)

### Database Extensions Enabled
- `pg_cron` - For scheduled jobs
- `pg_net` - For HTTP requests from database

---

## Edge Functions

1. **task-recommendations** - AI-powered task suggestions
2. **send-push-notification** - Sends web push and FCM notifications
3. **send-email** - Email notifications via Resend
4. **scheduled-notifications** - Hourly job for push notifications

---

## Features TO BE ADDED

### High Priority

#### 1. Cron Job Setup for Scheduled Notifications
- [ ] Set up hourly cron job using pg_cron to trigger `scheduled-notifications`
- [ ] SQL needed:
```sql
SELECT cron.schedule(
  'scheduled-notifications-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://zzwrugobhedcstcpsknz.supabase.co/functions/v1/scheduled-notifications',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer <ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb
  ) AS request_id;
  $$
);
```

#### 2. Use Database Notification Preferences in Decision Engine
- [ ] Update `notificationDecisionEngine.ts` to fetch from database
- [ ] Update `useNotificationScheduler.ts` to use database preferences
- [ ] Sync localStorage fallback with database

#### 3. Custom Reminder Times Integration
- [ ] Use `custom_reminder_times` array in notification scheduling
- [ ] Generate notifications at user-specified intervals before due

#### 4. Notification Type Toggles
- [ ] Add to database preferences:
  - `overdue_reminders_enabled`
  - `due_today_reminders_enabled`
  - `upcoming_reminders_enabled`
  - `daily_summary_enabled`
- [ ] Add UI toggles in NotificationSettingsCard
- [ ] Respect toggles in scheduling logic

### Medium Priority

#### 5. Notification Preview
- [ ] Show upcoming scheduled notifications for each task
- [ ] Display next notification time based on user preferences
- [ ] Preview in task detail/edit modal

#### 6. Smart Notification Batching
- [ ] Group multiple notifications to reduce interruptions
- [ ] Configurable batching window (e.g., every 30 min)

#### 7. Notification History
- [ ] Log sent notifications to database
- [ ] View notification history in settings
- [ ] Track open/dismiss rates

#### 8. iOS Push Notifications
- [ ] APNs integration for iOS native push
- [ ] Certificate configuration
- [ ] iOS-specific notification handling

### Low Priority / Nice to Have

#### 9. Location-Based Reminders
- [ ] Geofencing for task reminders
- [ ] "Remind me when I arrive at work" feature

#### 10. Calendar Integration
- [ ] Google Calendar sync
- [ ] Outlook Calendar sync
- [ ] Import/export iCal

#### 11. Team/Shared Tasks
- [ ] Workspace collaboration
- [ ] Task assignment
- [ ] Shared projects

#### 12. Offline Support
- [ ] Service worker caching
- [ ] Offline task creation/editing
- [ ] Sync when back online

#### 13. Widgets
- [ ] Android home screen widget
- [ ] iOS widget support
- [ ] Quick task add from widget

#### 14. Voice Input
- [ ] Voice-to-text task creation
- [ ] Voice commands for task management

#### 15. Gamification
- [ ] Achievement badges
- [ ] Points/XP system
- [ ] Leaderboards (optional)

---

## Secrets Configured
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FCM_SERVER_KEY` - Firebase Cloud Messaging
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` - Web Push
- `RESEND_API_KEY` - Email sending
- `LOVABLE_API_KEY` - AI features

---

## Key Files Reference

### Notifications
- `src/hooks/useNotificationPreferences.ts` - Database-backed preferences hook
- `src/hooks/useLocalNotifications.ts` - Local notification scheduling
- `src/hooks/useNotificationScheduler.ts` - Smart notification orchestration
- `src/utils/notificationDecisionEngine.ts` - Notification timing logic
- `src/components/NotificationSettingsCard.tsx` - Settings UI
- `src/components/CustomReminderTimesEditor.tsx` - Custom times UI
- `supabase/functions/scheduled-notifications/index.ts` - Server-side job
- `supabase/functions/send-push-notification/index.ts` - Push sender

### Tasks
- `src/components/TaskCard.tsx` - Task display
- `src/components/TaskDialog.tsx` - Task create/edit modal
- `src/pages/Dashboard.tsx` - Main task list

### Layout
- `src/components/AppLayout.tsx` - Main app wrapper
- `src/components/MobileBottomNav.tsx` - Mobile navigation

---

## Notes for Development
1. Always use semantic color tokens from `index.css` and `tailwind.config.ts`
2. RLS policies are enabled on all tables - ensure user_id is set correctly
3. Edge functions auto-deploy on save
4. Database migrations require user approval
5. Test on both web and mobile (Capacitor) for notification features
