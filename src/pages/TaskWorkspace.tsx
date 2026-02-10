import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  PlayCircle, 
  StopCircle, 
  Edit2, 
  Save, 
  X,
  TrendingUp,
  History,
  FileText,
  Timer,
  Calendar,
  Tag,
  Camera,
  Star
} from "lucide-react";
import CheckInModal from "@/components/CheckInModal";
import SubtaskList from "@/components/SubtaskList";
import EndSessionModal from "@/components/EndSessionModal";
import TaskProofUpload from "@/components/TaskProofUpload";
import { useWorkSessionTimer } from "@/hooks/useWorkSessionTimer";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  progress: number;
  notes: string | null;
  category: string;
  due_date: string | null;
  estimated_duration: number | null;
  created_at: string;
  completed_at: string | null;
}

interface CheckIn {
  id: string;
  created_at: string;
  response: string;
  mood: string | null;
  energy_level: number | null;
}

interface TaskHistory {
  id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

interface WorkSession {
  id: string;
  time_spent: number | null;
  notes: string | null;
  created_at: string;
}

const TaskWorkspace = () => {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([]);
  const [workSessions, setWorkSessions] = useState<WorkSession[]>([]);
  const [taskProofs, setTaskProofs] = useState<any[]>([]);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showEndSession, setShowEndSession] = useState(false);
  
  const {
    isWorking,
    sessionStart,
    elapsedSeconds,
    startSession,
    endSession,
    formatTime,
    formatTimeReadable,
  } = useWorkSessionTimer(taskId);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedNotes, setEditedNotes] = useState("");
  const [editedDueDate, setEditedDueDate] = useState("");

  useEffect(() => {
    loadTask();
    loadCheckIns();
    loadTaskHistory();
    loadWorkSessions();
    loadTaskProofs();
  }, [taskId]);

  const loadTask = async () => {
    if (!taskId) return;
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error) {
      toast.error("Failed to load task");
      navigate("/");
      return;
    }

    setTask(data);
    setEditedTitle(data.title);
    setEditedDescription(data.description || "");
    setEditedNotes(data.notes || "");
    setEditedDueDate(data.due_date ? new Date(data.due_date).toISOString().slice(0, 16) : "");
  };

  const loadCheckIns = async () => {
    if (!taskId) return;
    const { data } = await supabase
      .from("check_ins")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (data) setCheckIns(data);
  };

  const loadTaskHistory = async () => {
    if (!taskId) return;
    const { data } = await supabase
      .from("task_history")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (data) setTaskHistory(data);
  };

  const loadWorkSessions = async () => {
    if (!taskId) return;
    const { data } = await supabase
      .from("work_sessions")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (data) setWorkSessions(data);
  };

  const loadTaskProofs = async () => {
    if (!taskId) return;
    const { data } = await supabase
      .from("task_proofs")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    if (data) setTaskProofs(data);
  };

  const logTaskChange = async (field: string, oldValue: any, newValue: any, notes?: string) => {
    if (!taskId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("task_history").insert({
      task_id: taskId,
      user_id: user.id,
      field_changed: field,
      old_value: oldValue?.toString() || null,
      new_value: newValue?.toString() || null,
      notes: notes || null,
    });
    loadTaskHistory();
  };

  const handleStartSession = () => {
    startSession();
    toast.success("Work session started!");
  };

  const handleEndSessionClick = () => {
    setShowEndSession(true);
  };

  const handleEndSessionSave = async (notes: string, nextSteps: string) => {
    if (!sessionStart || !taskId) return;

    const durationMinutes = Math.floor(elapsedSeconds / 60);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("work_sessions").insert({
      user_id: user.id,
      task_id: taskId,
      time_spent: durationMinutes,
      notes: notes || null,
    });

    const sessionSummary = [
      `Duration: ${formatTimeReadable(elapsedSeconds)}`,
      notes ? `Notes: ${notes}` : null,
      nextSteps ? `Next steps: ${nextSteps}` : null,
    ].filter(Boolean).join(" | ");

    await logTaskChange("work_session", null, formatTimeReadable(elapsedSeconds), sessionSummary);
    endSession();
    setShowEndSession(false);
    loadWorkSessions();
    toast.success(`Work session completed! ${formatTimeReadable(elapsedSeconds)} logged.`);
  };

  const handleCheckInSubmit = async (response: string, mood?: string, energyLevel?: number) => {
    if (!taskId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("check_ins").insert({
      user_id: user.id,
      task_id: taskId,
      question: "How's your progress on this task?",
      response,
      mood,
      energy_level: energyLevel,
    });
    loadCheckIns();
  };

  const updateProgress = async (newProgress: number) => {
    if (!taskId || !task) return;
    const oldProgress = task.progress;
    const { error } = await supabase
      .from("tasks")
      .update({ progress: newProgress })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update progress");
      return;
    }

    await logTaskChange("progress", oldProgress, newProgress, `Progress updated from ${oldProgress}% to ${newProgress}%`);
    setTask(prev => prev ? { ...prev, progress: newProgress } : null);
    toast.success("Progress updated!");
  };

  const saveTitle = async () => {
    if (!taskId || !task || editedTitle.trim() === "") return;
    const { error } = await supabase
      .from("tasks")
      .update({ title: editedTitle })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update title");
      return;
    }

    await logTaskChange("title", task.title, editedTitle);
    setTask(prev => prev ? { ...prev, title: editedTitle } : null);
    setIsEditingTitle(false);
    toast.success("Title updated!");
  };

  const saveDescription = async () => {
    if (!taskId || !task) return;
    const { error } = await supabase
      .from("tasks")
      .update({ description: editedDescription })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update description");
      return;
    }

    await logTaskChange("description", task.description, editedDescription);
    setTask(prev => prev ? { ...prev, description: editedDescription } : null);
    setIsEditingDescription(false);
    toast.success("Description updated!");
  };

  const saveNotes = async () => {
    if (!taskId || !task) return;
    const { error } = await supabase
      .from("tasks")
      .update({ notes: editedNotes })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update notes");
      return;
    }

    await logTaskChange("notes", task.notes, editedNotes, "Notes updated");
    setTask(prev => prev ? { ...prev, notes: editedNotes } : null);
    setIsEditingNotes(false);
    toast.success("Notes saved!");
  };

  const updatePriority = async (newPriority: string) => {
    if (!taskId || !task) return;
    const { error } = await supabase
      .from("tasks")
      .update({ priority: newPriority })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update priority");
      return;
    }

    await logTaskChange("priority", task.priority, newPriority);
    setTask(prev => prev ? { ...prev, priority: newPriority } : null);
    toast.success("Priority updated!");
  };

  const saveDueDate = async () => {
    if (!taskId || !task) return;
    const newDueDate = editedDueDate ? new Date(editedDueDate).toISOString() : null;
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: newDueDate })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to update due date");
      return;
    }

    await logTaskChange("due_date", task.due_date, newDueDate);
    setTask(prev => prev ? { ...prev, due_date: newDueDate } : null);
    setIsEditingDueDate(false);
    toast.success("Due date updated!");
  };

  const clearDueDate = async () => {
    if (!taskId || !task) return;
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: null })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to clear due date");
      return;
    }

    await logTaskChange("due_date", task.due_date, null, "Due date cleared");
    setTask(prev => prev ? { ...prev, due_date: null } : null);
    setEditedDueDate("");
    setIsEditingDueDate(false);
    toast.success("Due date cleared!");
  };

  const completeTask = async () => {
    if (!taskId || !task) return;
    const { error } = await supabase
      .from("tasks")
      .update({ 
        status: "completed", 
        progress: 100,
        completed_at: new Date().toISOString()
      })
      .eq("id", taskId);

    if (error) {
      toast.error("Failed to complete task");
      return;
    }

    await logTaskChange("status", task.status, "completed", "Task marked as completed");
    toast.success("Task completed! 🎉");
    navigate("/");
  };

  const priorityColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    low: "bg-success/10 text-success border-success/20",
  };

  const totalTimeSpent = workSessions.reduce((acc, s) => acc + (s.time_spent || 0), 0);

  if (!task) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar at top */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-muted">
        <div 
          className="h-full bg-foreground transition-all duration-500 ease-out"
          style={{ width: `${task.progress}%` }}
        />
      </div>

      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* Static Info Sidebar */}
        <aside className="lg:w-80 xl:w-96 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-border/50 bg-card/50">
          <div className="p-4 md:p-6 space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <Button onClick={() => navigate("/")} variant="ghost" size="sm" className="rounded-xl -ml-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={completeTask} variant="outline" size="sm" className="rounded-xl">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Complete
              </Button>
            </div>

            {/* Work Session Button - MOVED TO TOP */}
            <Card className="rounded-xl border-0 shadow-sm bg-muted/30">
              <CardContent className="p-4">
                {!isWorking ? (
                  <Button 
                    onClick={handleStartSession} 
                    className="w-full rounded-xl bg-foreground text-background"
                    size="lg"
                  >
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Start Work Session
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-1">Session in progress</p>
                      <p className="text-3xl font-bold font-mono tracking-wider">
                        {formatTime(elapsedSeconds)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleEndSessionClick} 
                        className="flex-1 rounded-xl" 
                        variant="outline"
                        size="sm"
                      >
                        <StopCircle className="h-4 w-4 mr-1" />
                        End
                      </Button>
                      <Button 
                        onClick={() => setShowCheckIn(true)} 
                        className="flex-1 rounded-xl"
                        size="sm"
                      >
                        Check-in
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Task Title */}
            <div>
              {!isEditingTitle ? (
                <div className="group">
                  <h1 
                    className="font-heading text-xl md:text-2xl font-bold tracking-tight cursor-pointer hover:text-foreground/80 transition-colors"
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {task.title}
                    <Edit2 className="inline-block ml-2 h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </h1>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="text-xl font-bold rounded-xl"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveTitle} size="sm" className="rounded-xl">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button onClick={() => { setEditedTitle(task.title); setIsEditingTitle(false); }} variant="ghost" size="sm" className="rounded-xl">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Static Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-background border border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Progress
                </div>
                <p className="text-xl font-bold">{task.progress}%</p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Timer className="h-3 w-3" />
                  Time Spent
                </div>
                <p className="text-xl font-bold">{totalTimeSpent}m</p>
              </div>
              {!isEditingDueDate ? (
                <div 
                  className="p-3 rounded-xl bg-background border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => setIsEditingDueDate(true)}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Calendar className="h-3 w-3" />
                    Due Date
                    <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity ml-auto" />
                  </div>
                  <p className="text-sm font-medium">
                    {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "Not set"}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-background border border-border/50 col-span-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Calendar className="h-3 w-3" />
                    Due Date
                  </div>
                  <Input
                    type="datetime-local"
                    value={editedDueDate}
                    onChange={(e) => setEditedDueDate(e.target.value)}
                    className="text-sm rounded-xl mb-2"
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveDueDate} size="sm" className="rounded-xl flex-1">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    {task.due_date && (
                      <Button onClick={clearDueDate} variant="outline" size="sm" className="rounded-xl">
                        Clear
                      </Button>
                    )}
                    <Button onClick={() => { setEditedDueDate(task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : ""); setIsEditingDueDate(false); }} variant="ghost" size="sm" className="rounded-xl">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="p-3 rounded-xl bg-background border border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Tag className="h-3 w-3" />
                  Category
                </div>
                <p className="text-sm font-medium capitalize">{task.category}</p>
              </div>
            </div>

            {/* Priority Selection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Priority</p>
              <div className="flex gap-2">
                {["high", "medium", "low"].map((priority) => (
                  <Badge
                    key={priority}
                    variant="outline"
                    onClick={() => updatePriority(priority)}
                    className={`cursor-pointer transition-all duration-200 hover:scale-105 capitalize flex-1 justify-center py-1.5 rounded-lg ${
                      task.priority === priority 
                        ? priorityColors[priority as keyof typeof priorityColors] 
                        : "opacity-50 hover:opacity-100"
                    }`}
                  >
                    {priority}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{workSessions.length} sessions</span>
              <span>•</span>
              <span>{checkIns.length} check-ins</span>
            </div>
          </div>
        </aside>

        {/* Scrollable Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Description */}
            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isEditingDescription ? (
                  <div 
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors min-h-[60px]"
                    onClick={() => setIsEditingDescription(true)}
                  >
                    {task.description || "Click to add a description..."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={4}
                      className="rounded-xl"
                      placeholder="Add a detailed description..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveDescription} size="sm" className="rounded-xl">
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button onClick={() => { setEditedDescription(task.description || ""); setIsEditingDescription(false); }} variant="ghost" size="sm" className="rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subtasks */}
            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  Subtasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SubtaskList taskId={task.id} />
              </CardContent>
            </Card>

            {/* Proof of Completion */}
            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  Proof of Completion
                  {taskProofs.length > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-lg flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {(taskProofs.reduce((sum: number, p: any) => sum + (p.ai_rating || 0), 0) / taskProofs.length).toFixed(1)}/10
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TaskProofUpload
                  taskId={task.id}
                  taskTitle={task.title}
                  taskDescription={task.description}
                  proofs={taskProofs}
                  onProofAdded={loadTaskProofs}
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Progress Tracker
                  <Badge variant="secondary" className="ml-2 rounded-lg">{task.progress}%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Slider
                  value={[task.progress]}
                  onValueChange={(value) => updateProgress(value[0])}
                  max={100}
                  step={10}
                  className="py-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                    <Button
                      key={value}
                      onClick={() => updateProgress(value)}
                      variant={task.progress === value ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl min-w-[40px] px-2 text-xs"
                    >
                      {value}%
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isEditingNotes ? (
                  <div 
                    className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors min-h-[80px] whitespace-pre-wrap"
                    onClick={() => setIsEditingNotes(true)}
                  >
                    {task.notes || "Click to add notes..."}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Textarea
                      value={editedNotes}
                      onChange={(e) => setEditedNotes(e.target.value)}
                      rows={6}
                      className="rounded-xl font-mono text-sm"
                      placeholder="Add notes, ideas, links..."
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveNotes} size="sm" className="rounded-xl">
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                      <Button onClick={() => { setEditedNotes(task.notes || ""); setIsEditingNotes(false); }} variant="ghost" size="sm" className="rounded-xl">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Sessions History */}
            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  Work Sessions
                  <Badge variant="secondary" className="ml-2 rounded-lg">{workSessions.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No sessions yet</p>
                ) : (
                  <div className="space-y-2">
                    {workSessions.slice(0, 5).map((session) => (
                      <div key={session.id} className="p-3 rounded-xl bg-muted/30 border border-border/30">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-xs rounded-lg">
                            {session.time_spent ? `${session.time_spent} min` : "< 1 min"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(session.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {session.notes && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{session.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Update History */}
            <Card className="rounded-xl border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Update History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {taskHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No updates yet</p>
                ) : (
                  <div className="space-y-2">
                    {taskHistory.slice(0, 5).map((history) => (
                      <div key={history.id} className="p-3 rounded-xl bg-muted/30 border border-border/30">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize rounded-lg">
                            {history.field_changed === "work_session" ? "Session" : history.field_changed}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(history.created_at), "MMM d, h:mm a")}
                          </span>
                        </div>
                        {history.notes && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{history.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <CheckInModal
        open={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        question="How's your progress on this task?"
        onSubmit={handleCheckInSubmit}
      />

      <EndSessionModal
        open={showEndSession}
        onClose={() => setShowEndSession(false)}
        durationSeconds={elapsedSeconds}
        onSave={handleEndSessionSave}
      />
    </div>
  );
};

export default TaskWorkspace;