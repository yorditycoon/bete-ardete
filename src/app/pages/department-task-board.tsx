import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "../components/ui/dialog";
import { 
  CheckCircle2, CircleDashed, Clock, CalendarClock, 
  User, Plus, ArrowRight, Trash2, Loader2, PlayCircle
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";

interface TaskBoardProps {
  departmentId: string;
  currentUser: any;
  accentColor?: string; // e.g., "green", "amber", "rose"
}

export function DepartmentTaskBoard({ departmentId, currentUser, accentColor = "slate" }: TaskBoardProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Task State
  const [newTask, setNewTask] = useState({ title: "", assigned_to: "", due_date: "" });

  useEffect(() => {
    if (!departmentId) return;
    fetchData();

    const channel = supabase.channel(`tasks-${departmentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'department_tasks', filter: `department_id=eq.${departmentId}` }, () => {
        fetchData();
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [departmentId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all members in THIS department for the assignment dropdown
      const { data: deptMembers } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('department_id', departmentId)
        .order('name');
      if (deptMembers) setMembers(deptMembers);

      // 2. Fetch all tasks for this department
      const { data: deptTasks } = await supabase
        .from('department_tasks')
        .select(`*, assignee:profiles!department_tasks_assigned_to_fkey(name)`)
        .eq('department_id', departmentId)
        .order('due_date', { ascending: true });
      if (deptTasks) setTasks(deptTasks);

    } catch (error) {
      toast.error("Failed to load tasks.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assigned_to || !newTask.due_date) {
      return toast.error("Please fill in all fields.");
    }
    setIsAdding(true);
    try {
      // 1. Insert the new task and return the inserted data
      const { data: insertedTask, error } = await supabase.from('department_tasks').insert({
        title: newTask.title,
        department_id: departmentId,
        assigned_to: newTask.assigned_to,
        created_by: currentUser.id,
        due_date: newTask.due_date,
        status: 'pending'
      }).select().single();
      
      if (error) throw error;

      // 2. Trigger Notification to the assigned user
      if (insertedTask && insertedTask.assigned_to) {
        await supabase.from('notifications').insert({
          user_id: insertedTask.assigned_to,
          title: "New Task Assigned",
          message: `You were assigned: "${insertedTask.title}"`,
          type: "task",
          link: "/app/department" 
        });
      }

      toast.success("Task assigned successfully!");
      setNewTask({ title: "", assigned_to: "", due_date: "" });
      setShowAddModal(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('department_tasks').update({ status: newStatus }).eq('id', taskId);
      if (error) throw error;
      toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!window.confirm("Delete this task permanently?")) return;
    try {
      await supabase.from('department_tasks').delete().eq('id', taskId);
      toast.success("Task deleted.");
    } catch (error) {
      toast.error("Failed to delete task.");
    }
  };

  const isHead = currentUser?.department_role === 'head' || currentUser?.department_role === 'deputy' || currentUser?.role === 'admin';

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className={`w-8 h-8 animate-spin text-${accentColor}-500`} /></div>;

  return (
    <Card className={`border-${accentColor}-200 shadow-sm flex flex-col h-[500px]`}>
      <CardHeader className={`bg-${accentColor}-50/50 border-b border-gray-100 pb-4`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-gray-900">
            <Clock className={`w-5 h-5 text-${accentColor}-600`} /> Operations Board
          </CardTitle>
          
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button size="sm" className={`bg-${accentColor}-600 hover:bg-${accentColor}-700 text-white shadow-sm`}>
                <Plus className="w-4 h-4 mr-1" /> Assign Task
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New Assignment</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Task Description</label>
                  <Input placeholder="What needs to be done?" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Assign To</label>
                    <Select value={newTask.assigned_to} onValueChange={v => setNewTask({...newTask, assigned_to: v})}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent position="popper">
                        {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Due Date</label>
                    <Input type="date" value={newTask.due_date} onChange={e => setNewTask({...newTask, due_date: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateTask} disabled={isAdding} className={`w-full bg-${accentColor}-600 hover:bg-${accentColor}-700 text-white`}>
                  {isAdding ? "Assigning..." : "Assign Task"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 flex-1 overflow-y-auto space-y-3 pr-2 bg-gray-50/30">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No active tasks in this department.</p>
          </div>
        ) : (
          tasks.map(task => {
            const isAssignedToMe = task.assigned_to === currentUser?.id;
            const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'completed';

            return (
              <div key={task.id} className={`p-4 rounded-xl border bg-white shadow-sm flex flex-col gap-3 transition-all ${task.status === 'completed' ? 'opacity-70 border-gray-200' : isOverdue ? 'border-red-200 ring-1 ring-red-100' : `border-gray-200 hover:border-${accentColor}-300`}`}>
                
                {/* Top Row: Info */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <p className={`font-bold text-base ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>{task.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-gray-500">
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-md text-gray-700">
                        <User className="w-3 h-3" /> {task.assignee?.name || 'Unknown'}
                      </span>
                      <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                        <CalendarClock className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {task.status === 'pending' && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200"><CircleDashed className="w-3 h-3 mr-1"/> Pending</Badge>}
                    {task.status === 'in_progress' && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><PlayCircle className="w-3 h-3 mr-1"/> In Progress</Badge>}
                    {task.status === 'completed' && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/> Done</Badge>}
                  </div>
                </div>

                {/* Bottom Row: Actions */}
                <div className="flex justify-end gap-2 border-t border-gray-50 pt-2 mt-1">
                  {(isAssignedToMe || isHead) && task.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, 'in_progress')} className="h-7 text-xs bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
                      Accept Task <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                  {(isAssignedToMe || isHead) && task.status === 'in_progress' && (
                    <Button size="sm" onClick={() => updateTaskStatus(task.id, 'completed')} className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Complete
                    </Button>
                  )}
                  {isHead && (
                    <Button size="icon" variant="ghost" onClick={() => deleteTask(task.id)} className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}