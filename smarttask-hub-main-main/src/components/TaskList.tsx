import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  importance: number;
  task_tags: Array<{
    tags: {
      id: string;
      name: string;
    };
  }>;
}

interface TaskListProps {
  onEditTask: (task: Task) => void;
  refreshTrigger: number;
}

export const TaskList = ({ onEditTask, refreshTrigger }: TaskListProps) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("task_manager")
        .select("*")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("importance", { ascending: false });

      if (error) throw error;

      // Map tasks without tags (tags table doesn't exist in current schema)
      const tasksWithoutTags = (data || []).map(task => ({
        ...task,
        task_tags: []
      }));

      // Sort tasks: those with due_date first, then by importance
      const sortedTasks = tasksWithoutTags.sort((a, b) => {
        // Tasks with due_date come first
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        
        // Both have due_date or both don't
        if (a.due_date && b.due_date) {
          const dateComparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
          if (dateComparison !== 0) return dateComparison;
        }
        
        // Sort by importance if dates are equal or both null
        return b.importance - a.importance;
      });

      setTasks(sortedTasks);
    } catch (error: any) {
      toast.error("Failed to load tasks");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    // Set up realtime subscription
    const channel = supabase
      .channel("tasks-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_manager",
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshTrigger]);

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("task_manager")
        .delete()
        .eq("id", taskId);

      if (error) throw error;
      toast.success("Task deleted");
      fetchTasks();
    } catch (error: any) {
      toast.error("Failed to delete task");
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-2">No tasks yet</p>
        <p className="text-sm text-muted-foreground">Create your first task to get started!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <Card
          key={task.id}
          className={`cursor-pointer transition-all hover:shadow-md ${
            task.is_completed ? "opacity-60" : ""
          }`}
          onClick={() => onEditTask(task)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">
                    {task.title}
                  </h3>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < task.importance
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask(task.id);
                      }}
                      className="h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {task.due_date && (
                    <Badge variant="outline" className="text-xs">
                      Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};