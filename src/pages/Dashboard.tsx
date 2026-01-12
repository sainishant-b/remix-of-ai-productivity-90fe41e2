import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Calendar, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { isPast } from "date-fns";
import PrioritySection from "@/components/PrioritySection";
import CompletedTasksSection from "@/components/CompletedTasksSection";
import OverdueTasksSection from "@/components/OverdueTasksSection";
import TaskDialog from "@/components/TaskDialog";
import CheckInModal from "@/components/CheckInModal";
import AIRecommendations from "@/components/AIRecommendations";
import NotificationPrompt from "@/components/NotificationPrompt";
import StatsSidebar from "@/components/StatsSidebar";
import MobileStatsBar from "@/components/MobileStatsBar";
import { useCheckInScheduler } from "@/hooks/useCheckInScheduler";
import { useNotifications } from "@/hooks/useNotifications";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { useNotificationScheduler } from "@/hooks/useNotificationScheduler";
import { useLocalNotifications } from "@/hooks/useLocalNotifications";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  
  const { permission } = useNotifications();
  const { hasPermission } = useLocalNotifications();

  const checkInQuestions = [
    "What are you working on right now?",
    "How's your progress going?",
    "What's your energy level right now? (1-10)",
    "Feeling stuck on anything?",
    "What did you accomplish in the last hour?",
  ];

  const { formatNextCheckIn, isWorkHours } = useCheckInScheduler(profile, () => {
    if (!showCheckIn) {
      toast.info("Time for a check-in", {
        duration: 5000,
        action: {
          label: "Check-in",
          onClick: () => setShowCheckIn(true),
        },
      });
    }
  });

  // Set up notification scheduler for native scheduled notifications
  const { scheduleSmartTaskReminders, cancelTaskReminder } = useNotificationScheduler({
    profile,
    tasks,
    enabled: hasPermission,
  });

  useTaskReminders({ tasks, enabled: permission === "granted" });

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
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
    
    if (error) toast.error("Failed to load tasks");
    else setTasks(data || []);
    setLoading(false);
  };

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    setProfile(data);
  };

  const handleSaveTask = async (taskData: any) => {
    if (selectedTask) {
      const { error } = await supabase
        .from("tasks")
        .update(taskData)
        .eq("id", selectedTask.id);
      
      if (error) toast.error("Failed to update task");
      else toast.success("Task updated!");
    } else {
      const { error } = await supabase
        .from("tasks")
        .insert([{ ...taskData, user_id: user.id }]);
      
      if (error) toast.error("Failed to create task");
      else toast.success("Task created!");
    }
    
    fetchTasks();
    setSelectedTask(null);
  };

  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === "completed" ? "in_progress" : "completed";
    const { error } = await supabase
      .from("tasks")
      .update({ 
        status: newStatus,
        completed_at: newStatus === "completed" ? new Date().toISOString() : null,
        progress: newStatus === "completed" ? 100 : undefined
      })
      .eq("id", taskId);
    
    if (error) toast.error("Failed to update task");
    else {
      if (newStatus === "completed") {
        toast.success("Task completed");
        // Cancel any pending notification for this task
        handleTaskCompleted(taskId);
      }
    }
    
    fetchTasks();
  };

  const handleCheckInSubmit = async (response: string, mood?: string, energyLevel?: number) => {
    const randomQuestion = checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)];
    
    const { error } = await supabase.from("check_ins").insert([{
      user_id: user.id,
      question: randomQuestion,
      response,
      mood,
      energy_level: energyLevel,
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
          last_check_in_date: new Date().toISOString(),
        }).eq("id", user.id);
        
        fetchProfile();
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const completedTasks = tasks.filter(t => t.status === "completed");
  const overdueTasks = tasks.filter(t => 
    t.status !== "completed" && 
    t.due_date && 
    isPast(new Date(t.due_date))
  );
  const activeTasks = tasks.filter(t => 
    t.status !== "completed" && 
    !(t.due_date && isPast(new Date(t.due_date)))
  );
  
  // Group active tasks by priority
  const highPriorityTasks = activeTasks.filter(t => t.priority === "high");
  const mediumPriorityTasks = activeTasks.filter(t => t.priority === "medium");
  const lowPriorityTasks = activeTasks.filter(t => t.priority === "low");
  
  const completedCount = completedTasks.length;

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);
    
    if (error) toast.error("Failed to delete task");
    else toast.success("Task deleted");
    fetchTasks();
  };

  const handleSkipTask = async (taskId: string) => {
    // Skip = move due date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { error } = await supabase
      .from("tasks")
      .update({ due_date: tomorrow.toISOString() })
      .eq("id", taskId);
    
    if (error) toast.error("Failed to skip task");
    else toast.success("Task skipped to tomorrow");
    fetchTasks();
  };

  const handleRescheduleTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setShowTaskDialog(true);
    }
  };

  return (
    <div className="flex-1 overflow-hidden">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center justify-between px-3 md:px-4 lg:px-6 py-2 max-w-full">
          <h1 className="font-heading text-base md:text-lg font-bold tracking-tight truncate">AI Productivity</h1>
          <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
            {/* Desktop/Tablet nav buttons - hidden on mobile */}
            <Button variant="outline" size="sm" onClick={() => setShowCheckIn(true)} className="text-xs h-8 px-3 rounded-lg hidden md:flex">
              Check-in
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/calendar")} className="text-xs h-8 px-3 rounded-lg hidden md:flex">
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Calendar
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/insights")} className="text-xs h-8 px-3 rounded-lg hidden md:flex">
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Insights
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")} className="text-xs h-8 px-3 rounded-lg hidden md:flex">
              Settings
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-7 w-7 md:h-8 md:w-8">
              <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Stats bar for mobile only */}
      <div className="md:hidden">
        <MobileStatsBar 
          streak={profile?.current_streak || 0} 
          completedCount={completedCount}
          nextCheckIn={formatNextCheckIn()}
          isWorkHours={isWorkHours}
        />
      </div>

      {/* Main layout */}
      <div className="flex w-full overflow-hidden">
        {/* Sticky sidebar - tablet and desktop (md+) */}
        <div className="hidden md:block p-4 lg:p-6 shrink-0">
          <StatsSidebar
            streak={profile?.current_streak || 0}
            completedCount={completedCount}
            nextCheckIn={formatNextCheckIn()}
            isWorkHours={isWorkHours}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 p-3 md:p-4 lg:p-6 min-w-0 max-w-full md:max-w-4xl overflow-hidden">
          {showNotificationPrompt && permission === "default" && (
            <div className="mb-3 md:mb-4">
              <NotificationPrompt onDismiss={() => setShowNotificationPrompt(false)} />
            </div>
          )}

          {/* AI Recommendations */}
          {user && (
            <div className="mb-3 md:mb-4 lg:mb-6">
              <AIRecommendations onTaskUpdate={fetchTasks} />
            </div>
          )}

          {/* Task header */}
          <div className="flex items-center justify-between mb-2 md:mb-3">
            <h2 className="font-heading text-base md:text-lg font-bold">
              Active Tasks
              {activeTasks.length > 0 && (
                <span className="text-muted-foreground font-normal text-xs md:text-sm ml-1.5 md:ml-2">({activeTasks.length})</span>
              )}
            </h2>
            <Button 
              onClick={() => { setSelectedTask(null); setShowTaskDialog(true); }}
              size="sm"
              className="h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs rounded-lg hidden sm:flex"
            >
              <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
              New Task
            </Button>
          </div>

          {/* Task list */}
          {loading ? (
            <div className="flex items-center justify-center py-6 md:py-8">
              <div className="w-5 h-5 md:w-6 md:h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-6 md:p-8 text-center rounded-xl border-dashed border-2 border-border/50 bg-card/50">
              <p className="text-muted-foreground mb-2 md:mb-3 text-xs md:text-sm">No tasks yet. Create your first task!</p>
              <Button onClick={() => setShowTaskDialog(true)} size="sm" className="rounded-lg text-xs md:text-sm">
                <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />
                Create Task
              </Button>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {/* Overdue tasks section */}
              <OverdueTasksSection
                tasks={overdueTasks}
                onToggleComplete={handleToggleComplete}
                onClick={(id) => navigate(`/task/${id}`)}
                onSkip={handleSkipTask}
                onReschedule={handleRescheduleTask}
                onDelete={handleDeleteTask}
              />
              
              {/* Priority sections */}
              <PrioritySection
                priority="high"
                tasks={highPriorityTasks}
                onToggleComplete={handleToggleComplete}
                onClick={(id) => navigate(`/task/${id}`)}
                onSkip={handleSkipTask}
                onReschedule={handleRescheduleTask}
                onDelete={handleDeleteTask}
              />
              
              <PrioritySection
                priority="medium"
                tasks={mediumPriorityTasks}
                onToggleComplete={handleToggleComplete}
                onClick={(id) => navigate(`/task/${id}`)}
                onSkip={handleSkipTask}
                onReschedule={handleRescheduleTask}
                onDelete={handleDeleteTask}
              />
              
              <PrioritySection
                priority="low"
                tasks={lowPriorityTasks}
                onToggleComplete={handleToggleComplete}
                onClick={(id) => navigate(`/task/${id}`)}
                onSkip={handleSkipTask}
                onReschedule={handleRescheduleTask}
                onDelete={handleDeleteTask}
                defaultOpen={false}
              />

              {/* Completed tasks section */}
              <CompletedTasksSection
                tasks={completedTasks}
                onToggleComplete={handleToggleComplete}
                onClick={(id) => navigate(`/task/${id}`)}
              />
            </div>
          )}
        </main>
      </div>

      {/* Floating FAB for mobile - positioned above bottom nav */}
      <Button
        onClick={() => { setSelectedTask(null); setShowTaskDialog(true); }}
        size="icon"
        className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg md:hidden z-40"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <Plus className="h-5 w-5" />
      </Button>

      <TaskDialog
        open={showTaskDialog}
        onClose={() => { setShowTaskDialog(false); setSelectedTask(null); }}
        onSave={handleSaveTask}
        task={selectedTask}
      />

      <CheckInModal
        open={showCheckIn}
        onClose={() => setShowCheckIn(false)}
        question={checkInQuestions[Math.floor(Math.random() * checkInQuestions.length)]}
        onSubmit={handleCheckInSubmit}
      />
    </div>
  );
};

export default Dashboard;