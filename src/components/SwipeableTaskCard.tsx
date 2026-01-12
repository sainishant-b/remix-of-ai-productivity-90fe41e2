import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, ChevronDown, ChevronUp, Check, SkipForward, CalendarClock, Trash2 } from "lucide-react";
import { format, isPast } from "date-fns";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  status: "not_started" | "in_progress" | "completed";
  due_date?: string;
  estimated_duration?: number;
  category: string;
  progress: number;
}

interface SwipeableTaskCardProps {
  task: Task;
  onToggleComplete: (taskId: string, currentStatus: string) => void;
  onClick: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const SwipeableTaskCard = ({ 
  task, 
  onToggleComplete, 
  onClick,
  onSkip,
  onReschedule,
  onDelete,
}: SwipeableTaskCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const priorityColors = {
    high: "bg-destructive text-destructive-foreground",
    medium: "bg-warning text-warning-foreground",
    low: "bg-success text-success-foreground",
  };

  const priorityDotColors = {
    high: "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]",
    medium: "bg-warning shadow-[0_0_8px_rgba(234,179,8,0.5)]",
    low: "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]",
  };

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";
  const progress = task.status === "completed" ? 100 : task.progress;
  const showProgressFill = progress > 0;

  const { offsetX, direction, actionTriggered, swipeHandlers } = useSwipeGesture({
    onSwipeRight: () => {
      onToggleComplete(task.id, task.status);
    },
    onSwipeLeft: () => {
      setShowActionMenu(true);
    },
    swipeThreshold: 80,
    maxSwipeDistance: 120,
  });

  const handleActionClick = (action: 'skip' | 'reschedule' | 'delete') => {
    setShowActionMenu(false);
    if (action === 'skip' && onSkip) onSkip(task.id);
    if (action === 'reschedule' && onReschedule) onReschedule(task.id);
    if (action === 'delete' && onDelete) onDelete(task.id);
  };

  // Fixed widths for alignment
  const dateWidth = "w-[72px]"; // "Dec 31" = ~60px + padding
  const durationWidth = "w-[48px]"; // "999m" = ~40px + padding
  const categoryWidth = "w-[80px]"; // truncated category
  const priorityWidth = "w-[64px]"; // "medium" = ~55px + padding

  const renderDesktopContent = (inverted: boolean) => (
    <div className="hidden sm:flex items-center gap-3 px-4 py-3">
      <Checkbox
        checked={task.status === "completed"}
        onCheckedChange={() => onToggleComplete(task.id, task.status)}
        onClick={(e) => e.stopPropagation()}
        className={`shrink-0 transition-transform duration-200 hover:scale-110 ${
          inverted 
            ? "border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary" 
            : "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        }`}
      />
      
      <span
        className={`flex-1 font-medium text-sm truncate ${
          task.status === "completed" ? "line-through opacity-60" : ""
        } ${inverted ? "text-primary-foreground" : "text-foreground"}`}
      >
        {task.title}
      </span>

      {/* Fixed-width date container */}
      <div className={cn(
        "flex items-center justify-end gap-1 text-xs shrink-0",
        dateWidth,
        isOverdue && !inverted ? "text-destructive font-medium" : inverted ? "text-primary-foreground/70" : "text-muted-foreground"
      )}>
        {task.due_date ? (
          <>
            <Calendar className="h-3 w-3" />
            {format(new Date(task.due_date), "MMM d")}
          </>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Fixed-width duration container */}
      <div className={cn(
        "flex items-center justify-end gap-1 text-xs shrink-0",
        durationWidth,
        inverted ? "text-primary-foreground/70" : "text-muted-foreground"
      )}>
        {task.estimated_duration ? (
          <>
            <Clock className="h-3 w-3" />
            {task.estimated_duration}m
          </>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </div>

      {/* Fixed-width category container */}
      <div className={cn("shrink-0", categoryWidth)}>
        <Badge
          variant="outline"
          className={cn(
            "text-xs capitalize truncate max-w-full block text-center",
            inverted 
              ? "border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10" 
              : "border-border text-foreground"
          )}
        >
          {task.category}
        </Badge>
      </div>

      {/* Fixed-width priority container */}
      <div className={cn("shrink-0", priorityWidth)}>
        <Badge 
          className={cn(
            "text-xs capitalize block text-center",
            inverted 
              ? "bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30" 
              : priorityColors[task.priority]
          )}
        >
          {task.priority}
        </Badge>
      </div>
    </div>
  );

  const renderMobileContent = (inverted: boolean) => (
    <div className="sm:hidden px-3 py-2.5">
      {/* First line: Priority dot, Title, Expand button */}
      <div className="flex items-center gap-2">
        {/* Priority dot instead of checkbox on mobile */}
        <div 
          className={cn(
            "shrink-0 w-2.5 h-2.5 rounded-full",
            inverted ? "bg-primary-foreground/60" : priorityDotColors[task.priority]
          )}
          onClick={(e) => e.stopPropagation()}
        />
        <span
          className={`flex-1 font-medium text-sm truncate ${
            task.status === "completed" ? "line-through opacity-60" : ""
          } ${inverted ? "text-primary-foreground" : "text-foreground"}`}
        >
          {task.title}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={`p-1 rounded ${inverted ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Second line: Time + Category with fixed widths */}
      <div className={`flex items-center gap-3 mt-1 ml-4.5 text-xs ${inverted ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        {/* Fixed-width date */}
        <div className={cn(
          "flex items-center gap-1",
          isOverdue && !inverted ? "text-destructive font-medium" : ""
        )}>
          {task.due_date ? (
            <>
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), "MMM d")}
            </>
          ) : null}
        </div>
        {/* Fixed-width duration */}
        {task.estimated_duration && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {task.estimated_duration}m
          </div>
        )}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${
          inverted ? "border-primary-foreground/50 text-primary-foreground" : ""
        }`}>
          {task.category}
        </Badge>
      </div>

      {/* Expanded details */}
      {expanded && task.description && (
        <div className={`mt-2 ml-4.5 text-xs ${inverted ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {task.description}
        </div>
      )}
    </div>
  );

  // Mobile action menu overlay
  if (showActionMenu) {
    return (
      <Card className="relative overflow-hidden rounded-lg border-0">
        <div className="flex items-stretch">
          <button
            onClick={() => handleActionClick('skip')}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-4 bg-muted hover:bg-muted/80 transition-colors"
          >
            <SkipForward className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Skip</span>
          </button>
          <button
            onClick={() => handleActionClick('reschedule')}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-4 bg-warning/10 hover:bg-warning/20 transition-colors"
          >
            <CalendarClock className="h-5 w-5 text-warning" />
            <span className="text-xs text-warning">Reschedule</span>
          </button>
          <button
            onClick={() => handleActionClick('delete')}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-4 bg-destructive/10 hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="h-5 w-5 text-destructive" />
            <span className="text-xs text-destructive">Delete</span>
          </button>
        </div>
        <button
          onClick={() => setShowActionMenu(false)}
          className="w-full py-2 text-xs text-muted-foreground bg-card border-t"
        >
          Cancel
        </button>
      </Card>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe background indicators - mobile only */}
      <div className="sm:hidden absolute inset-0 flex">
        {/* Right swipe background (complete) */}
        <div 
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start pl-4 transition-colors",
            direction === 'right' ? (actionTriggered ? "bg-success" : "bg-success/50") : "bg-success/30"
          )}
          style={{ width: Math.max(0, offsetX) }}
        >
          <Check className={cn(
            "h-5 w-5 text-white transition-transform",
            actionTriggered && direction === 'right' ? "scale-125" : ""
          )} />
        </div>
        
        {/* Left swipe background (actions) */}
        <div 
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-colors",
            direction === 'left' ? (actionTriggered ? "bg-muted" : "bg-muted/50") : "bg-muted/30"
          )}
          style={{ width: Math.max(0, -offsetX) }}
        >
          <span className={cn(
            "text-xs text-muted-foreground transition-transform",
            actionTriggered && direction === 'left' ? "scale-110" : ""
          )}>
            Actions
          </span>
        </div>
      </div>

      {/* Card content */}
      <Card
        ref={cardRef}
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden border-0",
          isOverdue ? "ring-1 ring-destructive ring-offset-1" : ""
        )}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: offsetX === 0 ? 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
        }}
        onClick={() => !showActionMenu && onClick(task.id)}
        {...swipeHandlers}
      >
        <div className="relative bg-card">
          {renderDesktopContent(false)}
          {renderMobileContent(false)}
        </div>

        {showProgressFill && (
          <div
            className="absolute inset-0 bg-primary transition-all duration-500 ease-out"
            style={{
              clipPath: `inset(0 ${100 - progress}% 0 0)`,
            }}
          >
            {renderDesktopContent(true)}
            {renderMobileContent(true)}
          </div>
        )}
      </Card>
    </div>
  );
};

export default SwipeableTaskCard;
