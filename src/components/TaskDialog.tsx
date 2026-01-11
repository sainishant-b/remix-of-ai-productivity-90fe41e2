import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Minus, Plus, X, ChevronDown, Bell } from "lucide-react";
import { NotificationSchedulePreview } from "./NotificationSchedulePreview";

interface Task {
  id?: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  status: "not_started" | "in_progress" | "completed";
  due_date?: string;
  estimated_duration?: number;
  category: string;
  progress: number;
}

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  task?: Task;
}

const TaskDialog = ({ open, onClose, onSave, task }: TaskDialogProps) => {
  const [formData, setFormData] = useState<Partial<Task>>({
    title: "",
    description: "",
    priority: "medium",
    status: "not_started",
    category: "other",
    progress: 0,
  });
  const [showNotificationPreview, setShowNotificationPreview] = useState(false);

  // Build a task object for the notification preview
  const previewTask = useMemo(() => ({
    id: task?.id || 'preview',
    title: formData.title || 'New Task',
    due_date: formData.due_date || null,
    status: formData.status || 'not_started',
    priority: formData.priority || 'medium',
    estimated_duration: formData.estimated_duration,
    category: formData.category,
  }), [task?.id, formData.title, formData.due_date, formData.status, formData.priority, formData.estimated_duration, formData.category]);

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "not_started",
        category: "other",
        progress: 0,
      });
    }
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">{task ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What do you need to do?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add more details about this task..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="learning">Learning</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Select
                value={formData.estimated_duration?.toString() || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, estimated_duration: parseInt(value) })
                }
              >
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">Due Date & Time (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="due_date"
                type="datetime-local"
                value={formData.due_date || ""}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="flex-1"
              />
              {formData.due_date && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setFormData({ ...formData, due_date: undefined })}
                  title="Clear date"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Leave empty for tasks without a deadline</p>
          </div>

          {/* Notification Schedule Preview */}
          <Collapsible open={showNotificationPreview} onOpenChange={setShowNotificationPreview}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Bell className="h-4 w-4" />
                  Notification Schedule
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showNotificationPreview ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="rounded-lg border p-3 bg-muted/30">
                <NotificationSchedulePreview task={previewTask} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {task && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="progress">Progress</Label>
                <span className="text-sm font-medium">{formData.progress}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFormData({ 
                    ...formData, 
                    progress: Math.max(0, (formData.progress || 0) - 10) 
                  })}
                  disabled={(formData.progress || 0) <= 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Slider
                  id="progress"
                  value={[formData.progress || 0]}
                  onValueChange={(value) => setFormData({ ...formData, progress: value[0] })}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setFormData({ 
                    ...formData, 
                    progress: Math.min(100, (formData.progress || 0) + 10) 
                  })}
                  disabled={(formData.progress || 0) >= 100}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {task ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;
