import { useState } from "react";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CompactTaskCard from "./CompactTaskCard";

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
}

const OverdueTasksSection = ({ tasks, onToggleComplete, onClick }: OverdueTasksSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-3 md:mb-4">
      <CollapsibleTrigger className="flex items-center gap-1.5 md:gap-2 w-full py-1.5 md:py-2 px-2 md:px-3 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors text-xs md:text-sm font-medium text-destructive">
        {isOpen ? <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />}
        <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4" />
        Overdue Tasks ({tasks.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 md:mt-2 space-y-1.5 md:space-y-2">
        {tasks.map((task) => (
          <CompactTaskCard
            key={task.id}
            task={task}
            onToggleComplete={onToggleComplete}
            onClick={onClick}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default OverdueTasksSection;
