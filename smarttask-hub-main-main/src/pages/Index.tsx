import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, LogOut } from "lucide-react";
import { TaskList } from "@/components/TaskList";
import { TaskForm } from "@/components/TaskForm";
import { TaskStats } from "@/components/TaskStats";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  importance: number;
  is_completed: boolean;
  task_tags: Array<{
    tags: {
      id: string;
      name: string;
    };
  }>;
}

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          setUser(session.user);
        } else {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleTaskSaved = () => {
    setRefreshTrigger(prev => prev + 1);
    setEditingTask(null);
  };

  const handleNewTask = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Task Manager</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.user_metadata?.username || user?.email}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <TaskStats />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Your Tasks</h2>
          <Button onClick={handleNewTask}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>

        <TaskList onEditTask={handleEditTask} refreshTrigger={refreshTrigger} />

        <TaskForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editingTask={editingTask}
          onTaskSaved={handleTaskSaved}
        />
      </main>
    </div>
  );
};

export default Index;
