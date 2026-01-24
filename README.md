# Productivity Companion

An intelligent, AI-powered productivity and task management application designed to help you stay accountable, track your work sessions, and maintain productive habits through smart check-ins and personalized recommendations.

## Overview

AI Productivity Companion is a modern, full-stack web application built with React, TypeScript, and Tailwind CSS. It combines traditional task management with AI-driven insights and behavioral tracking to help users optimize their productivity. The app supports both web and native mobile platforms through Capacitor.

## Key Features

### Task Management
- **Create, Edit, and Organize Tasks** - Full CRUD functionality with priority levels (high, medium, low), categories, due dates, and estimated durations
- **Subtask Support** - Break down complex tasks into manageable subtasks with independent completion tracking
- **Progress Tracking** - Visual progress bars with percentage completion and quick update buttons
- **Task History** - Complete audit trail of all changes made to tasks (title, description, priority, progress updates)

### Work Session Timer
- **Pomodoro-Style Sessions** - Start/stop work sessions with real-time elapsed time tracking
- **Session Persistence** - Sessions survive browser refresh using localStorage
- **Session Notes** - End sessions with notes and next steps for continuity
- **Time Logging** - Automatic tracking of total time spent per task

### Smart Check-Ins
- **Scheduled Reminders** - Configurable check-in frequency during work hours
- **Mood & Energy Tracking** - Log emotional state and energy levels with each check-in
- **Quick Response Options** - Pre-defined responses for fast check-ins
- **Streak Tracking** - Gamified daily check-in streaks with current and longest streak stats

### AI-Powered Recommendations
- **Intelligent Task Scheduling** - AI suggests optimal times and order for completing tasks
- **Priority Insights** - AI-generated warnings for overdue or at-risk tasks
- **Productivity Tips** - Personalized insights based on your work patterns and check-in history

### Calendar & Visualization
- **Monthly/Weekly Views** - Toggle between month and week calendar layouts
- **Task Due Date Display** - Visual representation of tasks by due date
- **Quick Task Creation** - Click any date to create a task for that day
- **Activity Heatmap** - GitHub-style contribution graph showing daily task completion

### Notifications
- **Web Push Notifications** - Real-time reminders even when the app is closed (VAPID-based)
- **Task Due Reminders** - Automatic notifications for overdue, due today, and due tomorrow tasks
- **Check-In Prompts** - Scheduled reminders to complete check-ins during work hours

### Insights & Analytics
- **Total Completed Tasks** - Lifetime task completion counter
- **Streak Statistics** - Current and longest daily streak tracking
- **Weekly Summary** - Tasks completed in the current week
- **Yearly Heatmap** - Visual activity history with year navigation

### Mobile-First Design
- **Responsive UI** - Optimized layouts for mobile, tablet, and desktop
- **Mobile Bottom Navigation** - Touch-friendly navigation bar on mobile devices
- **Floating Action Button** - Quick task creation on mobile
- **Native App Support** - Capacitor integration for iOS and Android builds

### User Management
- **Authentication** - Email/password sign-up and sign-in with auto-confirm
- **User Profiles** - Customizable work hours, check-in frequency, and timezone
- **Theme Support** - Light and dark mode with system preference detection
- **Settings Persistence** - User preferences synced to the database

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks and functional components
- **TypeScript** - Full type safety across the codebase
- **Tailwind CSS** - Utility-first styling with custom design tokens
- **shadcn/ui** - High-quality, accessible component library
- **React Router v6** - Client-side routing
- **TanStack Query** - Server state management
- **Recharts** - Data visualization for insights

### Backend (Lovable Cloud / Supabase)
- **PostgreSQL** - Relational database for all data persistence
- **Row Level Security** - Secure, user-scoped data access
- **Edge Functions** - Serverless functions for AI recommendations and push notifications
- **Authentication** - Built-in auth with profile management

### Mobile
- **Capacitor** - Cross-platform native app builds
- **Status Bar Plugin** - Native status bar customization
- **App Plugin** - Native app lifecycle management

## Database Schema

| Table | Description |
|-------|-------------|
| `profiles` | User settings, work hours, streaks |
| `tasks` | Task data with progress, priority, dates |
| `subtasks` | Subtask items linked to parent tasks |
| `work_sessions` | Time tracking entries per task |
| `check_ins` | Check-in responses with mood/energy |
| `task_history` | Audit log of task changes |
| `push_subscriptions` | Web push notification subscriptions |

## Edge Functions

- **`task-recommendations`** - AI-powered task scheduling and insights using Lovable AI
- **`send-push-notification`** - Web Push notification delivery service

## Future Roadmap

### Short-Term Enhancements
- [ ] **Recurring Tasks** - Support for daily, weekly, monthly recurring tasks
- [ ] **Task Templates** - Save and reuse common task structures
- [ ] **Drag & Drop** - Reorder tasks with drag and drop
- [ ] **Bulk Actions** - Select multiple tasks for batch operations
- [ ] **Task Tags** - Custom tagging system beyond categories

### AI & Analytics Improvements
- [ ] **Productivity Score** - Daily/weekly productivity score based on activity
- [ ] **Work Pattern Analysis** - AI analysis of most productive times and habits
- [ ] **Smart Deadlines** - AI-suggested due dates based on task complexity
- [ ] **Focus Time Recommendations** - Suggested focus blocks based on calendar
- [ ] **Burnout Detection** - Warning system for overwork patterns

### Collaboration Features
- [ ] **Team Workspaces** - Shared task lists for teams
- [ ] **Task Assignment** - Assign tasks to team members
- [ ] **Comments & Mentions** - Discussion threads on tasks
- [ ] **Activity Feed** - Team activity timeline

### Integrations
- [ ] **Google Calendar Sync** - Two-way calendar synchronization
- [ ] **Slack Integration** - Notifications and check-ins via Slack
- [ ] **Notion Import** - Import tasks from Notion
- [ ] **GitHub Issues** - Sync with GitHub issue tracker
- [ ] **Zapier/Webhooks** - Custom automation workflows

### Mobile Enhancements
- [ ] **Offline Mode** - Full offline support with background sync
- [ ] **Widgets** - iOS and Android home screen widgets
- [ ] **Apple Watch** - Companion app for quick check-ins
- [ ] **Siri/Google Assistant** - Voice commands for task creation

### Gamification
- [ ] **Achievement Badges** - Unlock badges for productivity milestones
- [ ] **Leaderboards** - Optional competitive rankings
- [ ] **Reward System** - Customizable rewards for streak maintenance
- [ ] **Daily Challenges** - AI-generated productivity challenges

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. For native mobile builds, see the Capacitor section below

### Native Mobile Setup (Capacitor)

```bash
# Add platforms
npx cap add ios
npx cap add android

# Sync web build to native
npm run build
npx cap sync

# Run on device/emulator
npx cap run ios
npx cap run android
```

## Environment Variables

Required secrets for full functionality:
- `VAPID_PUBLIC_KEY` - Web Push public key
- `VAPID_PRIVATE_KEY` - Web Push private key
- `VITE_VAPID_PUBLIC_KEY` - Client-side VAPID public key

## License

MIT License - See LICENSE file for details
