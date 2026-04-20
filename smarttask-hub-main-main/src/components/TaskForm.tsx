import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface TaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask: Task | null;
  onTaskSaved: () => void;
}

export const TaskForm = ({ open, onOpenChange, editingTask, onTaskSaved }: TaskFormProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [importance, setImportance] = useState(3);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingTask) {
        setTitle(editingTask.title);
        setDescription(editingTask.description || "");
        setDueDate(editingTask.due_date ? new Date(editingTask.due_date) : undefined);
        setImportance(editingTask.importance);
      } else {
        resetForm();
      }
    }
  }, [open, editingTask]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate(undefined);
    setImportance(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const taskData = {
        title,
        description: description || null,
        due_date: dueDate ? dueDate.toISOString() : null,
        importance,
        user_id: session.session.user.id,
      };

      let taskId: string;
      if (editingTask) {
        const { error } = await supabase
          .from("task_manager")
          .update(taskData)
          .eq("id", editingTask.id);
        if (error) throw error;
        taskId = editingTask.id;
      } else {
        const { data, error } = await supabase
          .from("task_manager")
          .insert(taskData)
          .select()
          .single();
        if (error) throw error;
        taskId = data.id;
      }

      toast.success(editingTask ? "Task updated" : "Task created");
      onTaskSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save task");
    } finally {
      setLoading(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("task_manager")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
      toast.success("Task deleted");
      onTaskSaved();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
          <DialogDescription>
            {editingTask ? "Update your task details" : "Add a new task to your list"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Task title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task description (optional)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left">
                  {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Importance input */}
          <div className="space-y-2">
            <Label htmlFor="importance">Importance (1-5)</Label>
            <Input
              id="importance"
              type="number"
              min={1}
              max={5}
              value={importance}
              onChange={(e) => setImportance(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
