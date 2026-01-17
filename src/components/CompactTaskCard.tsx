import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { format, isPast } from "date-fns";
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
  repeat_enabled?: boolean;
}

interface CompactTaskCardProps {
  task: Task;
  onToggleComplete: (taskId: string, currentStatus: string) => void;
  onClick: (taskId: string) => void;
}

const CompactTaskCard = ({ task, onToggleComplete, onClick }: CompactTaskCardProps) => {
  const [expanded, setExpanded] = useState(false);
  
  const priorityColors = {
    high: "bg-destructive text-destructive-foreground",
    medium: "bg-warning text-warning-foreground",
    low: "bg-success text-success-foreground",
  };

  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "completed";
  const progress = task.status === "completed" ? 100 : task.progress;
  const showProgressFill = progress > 0;

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
        className={`flex-1 font-medium text-sm truncate flex items-center gap-1.5 ${
          task.status === "completed" ? "line-through opacity-60" : ""
        } ${inverted ? "text-primary-foreground" : "text-foreground"}`}
      >
        {task.repeat_enabled && (
          <Repeat className={cn("h-3.5 w-3.5 shrink-0", inverted ? "text-primary-foreground/70" : "text-primary")} />
        )}
        {task.title}
      </span>

      {task.due_date && (
        <div className={`flex items-center gap-1 text-xs shrink-0 ${
          isOverdue && !inverted ? "text-destructive font-medium" : inverted ? "text-primary-foreground/70" : "text-muted-foreground"
        }`}>
          <Calendar className="h-3 w-3" />
          {format(new Date(task.due_date), "MMM d")}
        </div>
      )}

      {task.estimated_duration && (
        <div className={`flex items-center gap-1 text-xs shrink-0 ${
          inverted ? "text-primary-foreground/70" : "text-muted-foreground"
        }`}>
          <Clock className="h-3 w-3" />
          {task.estimated_duration}m
        </div>
      )}

      <Badge
        variant="outline"
        className={`text-xs capitalize shrink-0 ${
          inverted 
            ? "border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10" 
            : "border-border text-foreground"
        }`}
      >
        {task.category}
      </Badge>

      <Badge 
        className={`text-xs shrink-0 ${
          inverted 
            ? "bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30" 
            : priorityColors[task.priority]
        }`}
      >
        {task.priority}
      </Badge>
    </div>
  );

  const renderMobileContent = (inverted: boolean) => (
    <div className="sm:hidden px-3 py-2.5">
      {/* First line: Checkbox, Title, Priority */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={task.status === "completed"}
          onCheckedChange={() => onToggleComplete(task.id, task.status)}
          onClick={(e) => e.stopPropagation()}
          className={`shrink-0 h-4 w-4 ${
            inverted 
              ? "border-primary-foreground data-[state=checked]:bg-primary-foreground data-[state=checked]:text-primary" 
              : "border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          }`}
        />
        <span
          className={`flex-1 font-medium text-sm truncate flex items-center gap-1 ${
            task.status === "completed" ? "line-through opacity-60" : ""
          } ${inverted ? "text-primary-foreground" : "text-foreground"}`}
        >
          {task.repeat_enabled && (
            <Repeat className={cn("h-3 w-3 shrink-0", inverted ? "text-primary-foreground/70" : "text-primary")} />
          )}
          {task.title}
        </span>
        <Badge 
          className={`text-[10px] px-1.5 py-0.5 shrink-0 ${
            inverted 
              ? "bg-primary-foreground/20 text-primary-foreground border border-primary-foreground/30" 
              : priorityColors[task.priority]
          }`}
        >
          {task.priority}
        </Badge>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={`p-1 rounded ${inverted ? "text-primary-foreground/70" : "text-muted-foreground"}`}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Second line: Time + Category */}
      <div className={`flex items-center gap-2 mt-1 ml-6 text-xs ${inverted ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
        {task.due_date && (
          <div className={`flex items-center gap-1 ${
            isOverdue && !inverted ? "text-destructive font-medium" : ""
          }`}>
            <Calendar className="h-3 w-3" />
            {format(new Date(task.due_date), "MMM d")}
          </div>
        )}
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
        <div className={`mt-2 ml-6 text-xs ${inverted ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {task.description}
        </div>
      )}
    </div>
  );

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group relative overflow-hidden rounded-lg border-0 max-w-full ${
        isOverdue ? "ring-1 ring-destructive ring-offset-1" : ""
      }`}
      onClick={() => onClick(task.id)}
    >
      <div className="relative">
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
  );
};

export default CompactTaskCard;