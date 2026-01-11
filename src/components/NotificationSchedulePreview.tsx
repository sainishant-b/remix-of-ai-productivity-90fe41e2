import { useMemo } from "react";
import { 
  calculateNotificationSchedule, 
  NotificationSchedule, 
  ScheduledNotificationTime 
} from "@/utils/notificationDecisionEngine";
import { Bell, BellOff, Clock, AlertTriangle, Calendar, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Task {
  id: string;
  title: string;
  due_date?: string | null;
  status: string;
  priority: string;
  estimated_duration?: number | null;
  category?: string;
}

interface NotificationSchedulePreviewProps {
  task: Task;
  workHoursStart?: string;
  workHoursEnd?: string;
  compact?: boolean;
}

const getNotificationIcon = (type: ScheduledNotificationTime['type']) => {
  switch (type) {
    case 'advance-notice':
      return <Calendar className="h-3.5 w-3.5" />;
    case 'reminder':
      return <Clock className="h-3.5 w-3.5" />;
    case 'final-reminder':
      return <Zap className="h-3.5 w-3.5" />;
    case 'overdue':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    case 'daily-summary':
      return <Bell className="h-3.5 w-3.5" />;
    default:
      return <Bell className="h-3.5 w-3.5" />;
  }
};

const getNotificationColor = (priority: 'high' | 'medium' | 'low', type: string) => {
  if (type === 'overdue') return 'destructive';
  if (type === 'final-reminder') return 'warning';
  
  switch (priority) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
    default:
      return 'secondary';
  }
};

export function NotificationSchedulePreview({
  task,
  workHoursStart = "09:00",
  workHoursEnd = "17:00",
  compact = false,
}: NotificationSchedulePreviewProps) {
  const schedule = useMemo(() => {
    return calculateNotificationSchedule(task, {
      work_hours_start: workHoursStart,
      work_hours_end: workHoursEnd,
    });
  }, [task, workHoursStart, workHoursEnd]);

  if (schedule.notifications.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <BellOff className="h-4 w-4" />
        <span>
          {task.priority === 'low' 
            ? "Low priority - no automatic notifications" 
            : task.due_date 
              ? "No upcoming notifications scheduled"
              : "No due date - add one for reminders"}
        </span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          {schedule.notifications.length} notification{schedule.notifications.length > 1 ? 's' : ''} scheduled
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4" />
        <span className="text-sm font-medium">Scheduled Notifications</span>
        <Badge variant="outline" className="text-xs">
          {schedule.notifications.length}
        </Badge>
      </div>
      
      <div className="space-y-2">
        {schedule.notifications.map((notif, index) => (
          <div 
            key={index}
            className="flex items-start gap-3 p-2 rounded-md bg-muted/50 text-sm"
          >
            <div className={`mt-0.5 ${
              notif.type === 'overdue' ? 'text-destructive' :
              notif.type === 'final-reminder' ? 'text-orange-500' :
              notif.priority === 'high' ? 'text-red-500' :
              'text-muted-foreground'
            }`}>
              {getNotificationIcon(notif.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">
                {notif.time.toLocaleDateString('en-US', { 
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                })} at {notif.time.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {notif.reason}
              </div>
            </div>
            <Badge 
              variant={notif.type === 'overdue' ? 'destructive' : 'secondary'}
              className="text-xs shrink-0"
            >
              {notif.type.replace('-', ' ')}
            </Badge>
          </div>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground">
        💡 {task.priority === 'high' 
          ? 'High priority tasks get multiple reminders' 
          : 'Medium priority tasks get a single reminder'}
      </p>
    </div>
  );
}
