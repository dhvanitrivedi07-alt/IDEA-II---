import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, isAfter, isBefore, addDays } from "date-fns";

interface TaskStatsData {
  totalTasks: number;
  completedTasks: number;
  upcomingTasks: Array<{
    id: string;
    title: string;
    due_date: string;
    importance: number;
  }>;
  importanceDistribution: Record<number, number>;
}

export const TaskStats = () => {
  const [stats, setStats] = useState<TaskStatsData>({
    totalTasks: 0,
    completedTasks: 0,
    upcomingTasks: [],
    importanceDistribution: {},
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const { data: tasks, error } = await supabase
        .from("task_manager")
        .select("id, title, due_date, importance");

      if (error) throw error;

      const totalTasks = tasks?.length || 0;
      const completedTasks = 0; // Not available in current schema

      // Get tasks due within next 7 days
      const now = new Date();
      const nextWeek = addDays(now, 7);
      const upcomingTasks = tasks
        ?.filter((t) => {
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          return isAfter(dueDate, now) && isBefore(dueDate, nextWeek);
        })
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 5) || [];

      // Calculate importance distribution
      const importanceDistribution: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      tasks?.forEach((task) => {
        importanceDistribution[task.importance] = (importanceDistribution[task.importance] || 0) + 1;
      });

      setStats({
        totalTasks,
        completedTasks,
        upcomingTasks,
        importanceDistribution,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("stats-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="space-y-6 mb-8">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedTasks} of {stats.totalTasks} tasks completed
            </p>
            <Progress value={completionRate} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              Due within next 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTasks - stats.completedTasks}
            </div>
            <p className="text-xs text-muted-foreground">
              Tasks in progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Importance Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task Priority Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map((importance) => {
              const count = stats.importanceDistribution[importance] || 0;
              const activeTasks = stats.totalTasks - stats.completedTasks;
              const percentage = activeTasks > 0 ? (count / activeTasks) * 100 : 0;

              return (
                <div key={importance} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[...Array(importance)].map((_, i) => (
                          <Star
                            key={i}
                            className="h-3 w-3 fill-yellow-400 text-yellow-400"
                          />
                        ))}
                        {[...Array(5 - importance)].map((_, i) => (
                          <Star
                            key={i}
                            className="h-3 w-3 text-muted-foreground"
                          />
                        ))}
                      </div>
                      <span className="text-muted-foreground">
                        {importance === 5 ? "Highest" : importance === 1 ? "Lowest" : ""}
                      </span>
                    </div>
                    <span className="font-medium">{count} tasks</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Deadlines List */}
      {stats.upcomingTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(task.due_date), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < task.importance
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};