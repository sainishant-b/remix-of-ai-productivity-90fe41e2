import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import SwipeableTaskCard from "./SwipeableTaskCard";

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

interface OverdueTasksSectionProps {
  tasks: Task[];
  onToggleComplete: (taskId: string, currentStatus: string) => void;
  onClick: (taskId: string) => void;
  onSkip?: (taskId: string) => void;
  onReschedule?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const OverdueTasksSection = ({ 
  tasks, 
  onToggleComplete, 
  onClick,
  onSkip,
  onReschedule,
  onDelete,
}: OverdueTasksSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-3 md:mb-4">
      <CollapsibleTrigger className="flex items-center gap-1.5 md:gap-2 w-full py-1.5 md:py-2 px-2 md:px-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-xs md:text-sm font-medium text-destructive">
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />}
        <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4" />
        <span>Overdue Tasks</span>
        <Badge variant="destructive" className="text-xs px-1.5 py-0 h-5 ml-1">
          {tasks.length}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 md:mt-2 space-y-1.5 md:space-y-2">
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

export default OverdueTasksSection;
