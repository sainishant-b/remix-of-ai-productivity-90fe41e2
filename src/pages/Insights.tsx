import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Flame, Trophy, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfYear, endOfYear, eachDayOfInterval, getMonth } from "date-fns";

interface TaskCompletionData {
  date: string;
  count: number;
}

const Insights = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [completionData, setCompletionData] = useState<TaskCompletionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

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
    if (user) {
      fetchData();
    }
  }, [user, selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    setProfile(profileData);

    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");
    
    setTotalCompleted(count || 0);

    const yearStart = startOfYear(new Date(selectedYear, 0, 1));
    const yearEnd = endOfYear(new Date(selectedYear, 0, 1));

    const { data: tasks } = await supabase
      .from("tasks")
      .select("completed_at")
      .eq("status", "completed")
      .gte("completed_at", yearStart.toISOString())
      .lte("completed_at", yearEnd.toISOString())
      .not("completed_at", "is", null);

    const dailyCounts: Record<string, number> = {};
    tasks?.forEach((task) => {
      if (task.completed_at) {
        const date = format(new Date(task.completed_at), "yyyy-MM-dd");
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      }
    });

    const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
    const completionArray = allDays.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return {
        date: dateStr,
        count: dailyCounts[dateStr] || 0,
      };
    });

    setCompletionData(completionArray);
    setLoading(false);
  };

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-muted/30";
    if (count >= 1) return "bg-white dark:bg-white";
    return "bg-white dark:bg-white";
  };

  // Group completion data by weeks for the horizontal heatmap (desktop)
  const getWeeks = () => {
    const weeks: TaskCompletionData[][] = [];
    let currentWeek: TaskCompletionData[] = [];

    completionData.forEach((day, index) => {
      const dayOfWeek = new Date(day.date).getDay();

      if (index === 0) {
        for (let i = 0; i < dayOfWeek; i++) {
          currentWeek.push({ date: "", count: -1 });
        }
      }

      currentWeek.push(day);

      if (dayOfWeek === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: "", count: -1 });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  };

  const getMonthLabels = () => {
    const labels: { month: string; position: number }[] = [];
    let currentMonth = -1;
    
    const weeks = getWeeks();
    weeks.forEach((week, wIndex) => {
      week.forEach((day) => {
        if (day.date) {
          const month = getMonth(new Date(day.date));
          if (month !== currentMonth) {
            currentMonth = month;
            labels.push({
              month: format(new Date(day.date), "MMM"),
              position: wIndex
            });
          }
        }
      });
    });
    
    return labels;
  };

  const weeks = getWeeks();
  const monthLabels = getMonthLabels();
  const currentYear = new Date().getFullYear();
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading insights...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background overflow-auto">
      <header className="border-b bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="font-heading text-xl sm:text-2xl font-bold">Insights</h1>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Card className="shadow-[var(--shadow-md)] transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 group">
            <CardHeader className="pb-1 sm:pb-3 p-3 sm:p-6">
              <CardTitle className="font-heading text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-success transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">Total Completed</span>
                <span className="sm:hidden">Completed</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <p className="text-2xl sm:text-4xl font-bold transition-transform duration-200 group-hover:scale-105">
                {totalCompleted}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">tasks</p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-md)] transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 group">
            <CardHeader className="pb-1 sm:pb-3 p-3 sm:p-6">
              <CardTitle className="font-heading text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <Flame className="h-3 w-3 sm:h-4 sm:w-4 text-warning transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">Current Streak</span>
                <span className="sm:hidden">Streak</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <p className="text-2xl sm:text-4xl font-bold transition-transform duration-200 group-hover:scale-105">
                {profile?.current_streak || 0}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">days</p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-md)] transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 group">
            <CardHeader className="pb-1 sm:pb-3 p-3 sm:p-6">
              <CardTitle className="font-heading text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-primary transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">Longest Streak</span>
                <span className="sm:hidden">Best</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <p className="text-2xl sm:text-4xl font-bold transition-transform duration-200 group-hover:scale-105">
                {profile?.longest_streak || 0}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">days</p>
            </CardContent>
          </Card>

          <Card className="shadow-[var(--shadow-md)] transition-all duration-300 hover:shadow-[var(--shadow-lg)] hover:-translate-y-1 group">
            <CardHeader className="pb-1 sm:pb-3 p-3 sm:p-6">
              <CardTitle className="font-heading text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-accent-foreground transition-transform duration-200 group-hover:scale-110" />
                <span className="hidden sm:inline">This Week</span>
                <span className="sm:hidden">Week</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <p className="text-2xl sm:text-4xl font-bold transition-transform duration-200 group-hover:scale-105">
                {completionData.slice(-7).reduce((sum, day) => sum + day.count, 0)}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">tasks</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Heatmap */}
        <Card className="shadow-[var(--shadow-md)]">
          <CardHeader className="p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading text-base sm:text-lg font-semibold">Activity Heatmap</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">Your task completion activity</p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedYear(selectedYear - 1)}
                  className="h-7 w-7 sm:h-8 sm:w-8"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <span className="font-heading font-semibold text-sm sm:text-lg min-w-[50px] sm:min-w-[60px] text-center">
                  {selectedYear}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedYear(selectedYear + 1)}
                  disabled={selectedYear >= currentYear}
                  className="h-7 w-7 sm:h-8 sm:w-8"
                >
                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0">
            {/* Desktop Heatmap - Horizontal */}
            <div className="hidden sm:block overflow-x-auto">
              <div className="w-full">
                {/* Month labels */}
                <div className="flex mb-2 text-xs text-muted-foreground relative h-4">
                  <div className="w-10" />
                  <div className="flex-1 relative">
                    {monthLabels.map((label, i) => (
                      <span
                        key={i}
                        className="absolute"
                        style={{ left: `${(label.position / weeks.length) * 100}%` }}
                      >
                        {label.month}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Heatmap grid */}
                <div className="flex justify-between">
                  {/* Day labels */}
                  <div className="flex flex-col gap-[3px] text-xs text-muted-foreground pr-2 w-8 shrink-0">
                    <div className="h-[12px]" />
                    <div className="h-[12px] flex items-center">Mon</div>
                    <div className="h-[12px]" />
                    <div className="h-[12px] flex items-center">Wed</div>
                    <div className="h-[12px]" />
                    <div className="h-[12px] flex items-center">Fri</div>
                    <div className="h-[12px]" />
                  </div>
                  
                  {/* Weeks */}
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[3px]">
                      {week.map((day, dayIndex) => (
                        <div
                          key={`${weekIndex}-${dayIndex}`}
                          className={`w-[12px] h-[12px] rounded-sm transition-all duration-200 hover:scale-125 hover:ring-2 hover:ring-primary/50 ${
                            day.count === -1 ? "bg-transparent" : getHeatmapColor(day.count)
                          }`}
                          title={day.date ? `${day.date}: ${day.count} task${day.count !== 1 ? "s" : ""}` : ""}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
                  <span>No tasks</span>
                  <div className="w-[12px] h-[12px] rounded-sm bg-muted/30" />
                  <div className="w-[12px] h-[12px] rounded-sm bg-white dark:bg-white" />
                  <span>Completed</span>
                </div>
              </div>
            </div>

            {/* Mobile Heatmap - Vertical (weeks as rows, days as columns) */}
            <div className="sm:hidden">
              <div className="w-full">
                {/* Day labels header */}
                <div className="flex gap-[3px] mb-2">
                  <div className="w-8 shrink-0" />
                  {dayLabels.map((day, i) => (
                    <div
                      key={i}
                      className="flex-1 text-[9px] text-muted-foreground text-center"
                    >
                      {day.slice(0, 1)}
                    </div>
                  ))}
                </div>

                {/* Weeks as rows */}
                <div className="flex flex-col gap-[3px]">
                  {weeks.map((week, weekIndex) => {
                    // Get month label for first day of week
                    const firstDayWithDate = week.find(d => d.date);
                    const showMonth = firstDayWithDate && 
                      (weekIndex === 0 || 
                       (weekIndex > 0 && weeks[weekIndex - 1].find(d => d.date) && 
                        getMonth(new Date(firstDayWithDate.date)) !== getMonth(new Date(weeks[weekIndex - 1].find(d => d.date)!.date))));
                    
                    return (
                      <div key={weekIndex} className="flex gap-[3px] items-center">
                        {/* Month label */}
                        <div className="w-8 text-[9px] text-muted-foreground shrink-0">
                          {showMonth && firstDayWithDate ? format(new Date(firstDayWithDate.date), "MMM") : ""}
                        </div>
                        {/* Days */}
                        {week.map((day, dayIndex) => (
                          <div
                            key={`${weekIndex}-${dayIndex}`}
                            className={`flex-1 aspect-square max-w-[12px] rounded-[2px] transition-all duration-200 ${
                              day.count === -1 ? "bg-transparent" : getHeatmapColor(day.count)
                            }`}
                            title={day.date ? `${day.date}: ${day.count} task${day.count !== 1 ? "s" : ""}` : ""}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground">
                  <span>No tasks</span>
                  <div className="w-[10px] h-[10px] rounded-[2px] bg-muted/30" />
                  <div className="w-[10px] h-[10px] rounded-[2px] bg-white dark:bg-white" />
                  <span>Completed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Insights;
