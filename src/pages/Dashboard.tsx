import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { isPast, format } from "date-fns";
import PrioritySection from "@/components/PrioritySection";
import CompletedTasksSection from "@/components/CompletedTasksSection";
import OverdueTasksSection from "@/components/OverdueTasksSection";
import TaskDialog from "@/components/TaskDialog";
import CheckInModal from "@/components/CheckInModal";
import AIRecommendations from "@/components/AIRecommendations";
import NotificationPrompt from "@/components/NotificationPrompt";
import StatsSidebar from "@/components/StatsSidebar";
import MobileStatsBar from "@/components/MobileStatsBar";
import ProofUploadDialog from "@/components/ProofUploadDialog";
import { useCheckInScheduler } from "@/hooks/useCheckInScheduler";
import { useNotifications } from "@/hooks/useNotifications";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { invalidateRecommendations } from "@/utils/recommendationCache";
import { toggleRepeatCompletion, isCompletedToday } from "@/utils/repeatCompletionUtils";

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [proofTask, setProofTask] = useState<any>(null);
  const [verificationAvg, setVerificationAvg] = useState(0);
  const [verificationCount, setVerificationCount] = useState(0);
  const {
    permission
  } = useNotifications();
  const {
    hasPermission
  } = useLocalNotifications();
  const checkInQuestions = ["What are you working on right now?", "How's your progress going?", "What's your energy level right now? (1-10)", "Feeling stuck on anything?", "What did you accomplish in the last hour?"];
  const {
    formatNextCheckIn,
    isWorkHours
  } = useCheckInScheduler(profile, () => {
    if (!showCheckIn) {
      toast.info("Time for a check-in", {
        duration: 5000,
        action: {
          label: "Check-in",
          onClick: () => setShowCheckIn(true)
        }
      });
    }
  });

  // Set up notification scheduler for native scheduled notifications
  const {
    scheduleSmartTaskReminders,
    cancelTaskReminder
  } = useNotificationScheduler({
    profile,
    tasks,
    enabled: hasPermission
  });
  useTaskReminders({
    tasks,
    enabled: permission === "granted"
  });

  // Handler for scheduling smart reminders from AI recommendations
  const handleAIRecommendationsLoaded = useCallback((recommendations: any[]) => {
    if (recommendations && recommendations.length > 0 && hasPermission) {
      scheduleSmartTaskReminders(recommendations);
    }
  }, [hasPermission, scheduleSmartTaskReminders]);

  // Cancel task reminder when task is completed
  const handleTaskCompleted = useCallback((taskId: string) => {
    cancelTaskReminder(taskId);
  }, [cancelTaskReminder]);
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  useEffect(() => {
    const handleOpenCheckIn = () => {
      setShowCheckIn(true);
    };
    window.addEventListener("open-checkin", handleOpenCheckIn);
    return () => window.removeEventListener("open-checkin", handleOpenCheckIn);
  }, []);
  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchProfile();
    }
  }, [user]);
  
  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Failed to load tasks");
      setLoading(false);
      return;
    }
    
    // For repeating tasks, check if they're completed today
    const tasksWithCompletionStatus = await Promise.all(
      (data || []).map(async (task) => {
        if (task.repeat_enabled) {
          const completedToday = await isCompletedToday(task.id);
          return { ...task, isCompletedToday: completedToday };
        }
        return task;
      })
    );
    
    setTasks(tasksWithCompletionStatus);
    setLoading(false);
  };
  const fetchProfile = async () => {
    const {
      data
    } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(data);
    const proofCount = data?.total_proofs_submitted || 0;
    const proofAvg = proofCount > 0 ? (data?.total_ai_rating || 0) / proofCount : 0;
    setVerificationAvg(proofAvg);
    setVerificationCount(proofCount);
  };
  const handleSaveTask = async (taskData: any) => {
    const isNewTask = !selectedTask;
    
    if (selectedTask) {
      const {
        error
      } = await supabase.from("tasks").update(taskData).eq("id", selectedTask.id);
      if (error) toast.error("Failed to update task");else toast.success("Task updated!");
    } else {
      const {
        error
      } = await supabase.from("tasks").insert([{
        ...taskData,
        user_id: user.id
      }]);
      if (error) toast.error("Failed to create task");else {
        toast.success("Task created!");
        // Invalidate recommendations when a new task is added
        invalidateRecommendations();
      }
    }
    fetchTasks();
    setSelectedTask(null);
  };
  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;
    
    // Handle repeating tasks differently
    if (task.repeat_enabled) {
      try {
        const config = {
          repeat_enabled: true,
          repeat_frequency: task.repeat_frequency || 1,
          repeat_unit: task.repeat_unit || "week",
          repeat_days_of_week: task.repeat_days_of_week || [],
          repeat_times: task.repeat_times || [],
        };
        
        const result = await toggleRepeatCompletion(taskId, user.id, config);
        
        if (result.completed) {
          if (result.currentStreak > 1) {
            toast.success(`🔥 ${result.currentStreak} day streak!`);
          } else {
            toast.success("Completed for today!");
          }
          if (task.requires_proof) {
            setProofTask(task);
            setShowProofDialog(true);
          }
          handleTaskCompleted(taskId);
          invalidateRecommendations();
        } else {
          toast.info("Unmarked for today");
        }
        
        fetchTasks();
      } catch (error) {
        console.error("Failed to toggle repeat completion:", error);
        toast.error("Failed to update task");
      }
      return;
    }
    
    // Regular task completion logic
    const newStatus = currentStatus === "completed" ? "in_progress" : "completed";
    
    const { error } = await supabase
      .from("tasks")
      .update({
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        progress: newStatus === "completed" ? 100 : undefined
      })
      .eq("id", taskId);
    
    if (error) {
      toast.error("Failed to update task");
    } else {
      if (newStatus === "completed") {
        const completedTask = tasks.find(t => t.id === taskId);
        if (completedTask?.requires_proof) {
          setProofTask(completedTask);
          setShowProofDialog(true);
          toast.success("Task completed! Upload your proof photo.");
        } else {
          toast.success("Task completed!");
        }
        handleTaskCompleted(taskId);
        invalidateRecommendations();
      }
    }
    
    fetchTasks();
  };
  const handleCheckInSubmit = async (response: string, mood?: string, energyLevel?: number) => {
    const randomQuestion = checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)];
    const {
      error
    } = await supabase.from("check_ins").insert([{
      user_id: user.id,
      question: randomQuestion,
      response,
      mood,
      energy_level: energyLevel
    }]);
    if (!error && profile) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastCheckIn = profile.last_check_in_date ? new Date(profile.last_check_in_date) : null;
      if (lastCheckIn) lastCheckIn.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (!lastCheckIn || lastCheckIn.getTime() !== today.getTime()) {
        let newStreak = 1;
        if (lastCheckIn && lastCheckIn.getTime() === yesterday.getTime()) {
          newStreak = profile.current_streak + 1;
        }
        await supabase.from("profiles").update({
          current_streak: newStreak,
          longest_streak: Math.max(profile.longest_streak, newStreak),
          last_check_in_date: new Date().toISOString()
        }).eq("id", user.id);
        fetchProfile();
      }
    }
  };
  const completedTasks = tasks.filter(t => t.status === "completed");
  const overdueTasks = tasks.filter(t => t.status !== "completed" && t.due_date && isPast(new Date(t.due_date)));
  const activeTasks = tasks.filter(t => t.status !== "completed" && !(t.due_date && isPast(new Date(t.due_date))));

  // Group active tasks by priority
  const highPriorityTasks = activeTasks.filter(t => t.priority === "high");
  const mediumPriorityTasks = activeTasks.filter(t => t.priority === "medium");
  const lowPriorityTasks = activeTasks.filter(t => t.priority === "low");
  const completedCount = completedTasks.length;
  const handleDeleteTask = async (taskId: string) => {
    const {
      error
    } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) toast.error("Failed to delete task");else toast.success("Task deleted");
    fetchTasks();
  };
  const handleSkipTask = async (taskId: string) => {
    // Skip = move due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const {
      error
    } = await supabase.from("tasks").update({
      due_date: tomorrow.toISOString()
    }).eq("id", taskId);
    if (error) toast.error("Failed to skip task");else toast.success("Task skipped to tomorrow");
    fetchTasks();
  };
  const handleRescheduleTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setShowTaskDialog(true);
    }
  };

  const handleRescheduleAllOverdue = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Set to 9 AM tomorrow
    
    const overdueTaskIds = overdueTasks.map(t => t.id);
    if (overdueTaskIds.length === 0) return;

    const { error } = await supabase
      .from("tasks")
      .update({ due_date: tomorrow.toISOString() })
      .in("id", overdueTaskIds);

    if (error) {
      toast.error("Failed to reschedule tasks");
    } else {
      toast.success(`${overdueTaskIds.length} task${overdueTaskIds.length > 1 ? 's' : ''} rescheduled to tomorrow`);
      fetchTasks();
    }
  };
  return <div className="flex-1 overflow-hidden">
      {/* Stats bar for mobile/native only */}
      {isMobile && (
        <MobileStatsBar streak={profile?.current_streak || 0} completedCount={completedCount} nextCheckIn={formatNextCheckIn()} isWorkHours={isWorkHours} />
      )}

      {/* Main layout */}
      <div className="flex w-full overflow-hidden">
        {/* Sticky sidebar - tablet and desktop only (not on native) */}
        {!isMobile && (
          <div className="p-4 lg:p-6 shrink-0">
            <StatsSidebar streak={profile?.current_streak || 0} completedCount={completedCount} nextCheckIn={formatNextCheckIn()} isWorkHours={isWorkHours} verificationAvg={verificationAvg} verificationCount={verificationCount} />
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-3 md:p-4 lg:p-6 min-w-0 max-w-full md:max-w-4xl overflow-hidden">
          {showNotificationPrompt && permission === "default" && <div className="mb-3 md:mb-4">
              <NotificationPrompt onDismiss={() => setShowNotificationPrompt(false)} />
            </div>}

          {/* AI Recommendations */}
          {user && <div className="mb-3 md:mb-4 lg:mb-6">
              <AIRecommendations onTaskUpdate={fetchTasks} />
            </div>}

          {/* Task header */}
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h2 className="font-heading text-base md:text-lg font-bold">
              Active Tasks
              {activeTasks.length > 0 && <span className="text-muted-foreground font-normal text-xs md:text-sm ml-1.5 md:ml-2">({activeTasks.length})</span>}
            </h2>
            <Button onClick={() => {
            setSelectedTask(null);
            setShowTaskDialog(true);
          }} size="sm" className="h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs rounded-lg hidden sm:flex">
              <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
              New Task
            </Button>
          </div>

          {/* Task list */}
          {loading ? <div className="flex items-center justify-center py-6 md:py-8">
              <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div> : tasks.length === 0 ? <div className="p-6 md:p-8 text-center rounded-xl border-dashed border-2 border-border/50 bg-card/50">
              <p className="text-muted-foreground mb-2 md:mb-3 text-xs md:text-sm">No tasks yet. Create your first task!</p>
              <Button onClick={() => setShowTaskDialog(true)} size="sm" className="rounded-lg text-xs md:text-sm">
                <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
                Create Task
              </Button>
            </div> : <div className="space-y-3 md:space-y-4">
              {/* Overdue tasks section */}
              <OverdueTasksSection tasks={overdueTasks} onToggleComplete={handleToggleComplete} onClick={id => navigate(`/task/${id}`)} onSkip={handleSkipTask} onReschedule={handleRescheduleTask} onDelete={handleDeleteTask} onRescheduleAll={handleRescheduleAllOverdue} />
              
              {/* Priority sections */}
              <PrioritySection priority="high" tasks={highPriorityTasks} onToggleComplete={handleToggleComplete} onClick={id => navigate(`/task/${id}`)} onSkip={handleSkipTask} onReschedule={handleRescheduleTask} onDelete={handleDeleteTask} />
              
              <PrioritySection priority="medium" tasks={mediumPriorityTasks} onToggleComplete={handleToggleComplete} onClick={id => navigate(`/task/${id}`)} onSkip={handleSkipTask} onReschedule={handleRescheduleTask} onDelete={handleDeleteTask} />
              
              <PrioritySection priority="low" tasks={lowPriorityTasks} onToggleComplete={handleToggleComplete} onClick={id => navigate(`/task/${id}`)} onSkip={handleSkipTask} onReschedule={handleRescheduleTask} onDelete={handleDeleteTask} defaultOpen={false} />

              {/* Completed tasks section */}
              <CompletedTasksSection tasks={completedTasks} onToggleComplete={handleToggleComplete} onClick={id => navigate(`/task/${id}`)} />
            </div>}
        </main>
      </div>

      {/* Floating FAB for mobile/native - positioned above bottom nav */}
      {isMobile && (
        <Button onClick={() => {
          setSelectedTask(null);
          setShowTaskDialog(true);
        }} size="icon" className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg z-40" style={{
          marginBottom: "env(safe-area-inset-bottom, 0px)"
        }}>
          <Plus className="h-5 w-5" />
        </Button>
      )}

      <TaskDialog open={showTaskDialog} onClose={() => {
      setShowTaskDialog(false);
      setSelectedTask(null);
    }} onSave={handleSaveTask} task={selectedTask} />

      <CheckInModal open={showCheckIn} onClose={() => setShowCheckIn(false)} question={checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)]} onSubmit={handleCheckInSubmit} />

      {showProofDialog && proofTask && (
        <ProofUploadDialog
          open={showProofDialog}
          onClose={() => { setShowProofDialog(false); setProofTask(null); }}
          task={proofTask}
          onVerified={() => fetchProfile()}
        />
      )}
    </div>;
};
export default Dashboard;