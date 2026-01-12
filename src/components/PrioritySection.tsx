import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import SwipeableTaskCard from "./SwipeableTaskCard";
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

interface PrioritySectionProps {
  priority: "high" | "medium" | "low";
  tasks: Task[];
  onToggleComplete: (taskId: string, currentStatus: string) => void;
  onClick: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  defaultOpen?: boolean;
}

const priorityConfig = {
  high: {
    label: "High Priority",
    color: "bg-destructive text-destructive-foreground",
    dotColor: "bg-destructive",
  },
  medium: {
    label: "Medium Priority", 
    color: "bg-warning text-warning-foreground",
    dotColor: "bg-warning",
  },
  low: {
    label: "Low Priority",
    color: "bg-success text-success-foreground",
    dotColor: "bg-success",
  },
};

const PrioritySection = ({
  priority,
  tasks,
  onToggleComplete,
  onClick,
  onSkip,
  onReschedule,
  onDelete,
  defaultOpen = true,
}: PrioritySectionProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = priorityConfig[priority];

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 hover:bg-muted/50 rounded-lg transition-colors group">
        <div className="flex items-center gap-2 flex-1">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
          )}
          <div className={cn("w-2 h-2 rounded-full", config.dotColor)} />
          <span className="text-sm font-medium text-foreground">
            {config.label}
          </span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
            {tasks.length}
          </Badge>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="space-y-1.5 mt-1">
        {tasks.map((task) => (
          <SwipeableTaskCard
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onClick={onClick}
            onSkip={onSkip}
            onReschedule={onReschedule}
            onDelete={onDelete}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default PrioritySection;
