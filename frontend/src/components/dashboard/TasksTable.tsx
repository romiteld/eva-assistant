import React, { useState, useEffect } from 'react';
import { CheckSquare, Clock, AlertCircle, Calendar, User, Plus, Edit2, Trash2, Filter, Search, MoreVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/hooks/useTasks';
import { toast } from '@/hooks/use-toast';
import { LoadingStates } from '@/components/ui/loading-states';

interface Task {
  id: string;
  title: string;
  description?: string;
  assigned_agent?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

interface TaskFormData {
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: number;
  due_date: string;
  assigned_agent: string;
}

const priorityLabels = {
  0: 'Low',
  0.33: 'Medium',
  0.66: 'High',
  1: 'Critical'
};

export function TasksTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    status: 'pending',
    priority: 0.5,
    due_date: '',
    assigned_agent: ''
  });

  const { 
    tasks, 
    loading, 
    error, 
    createTask, 
    updateTask, 
    deleteTask, 
    completeTask, 
    startTask 
  } = useTasks({
    autoRefresh: true,
    refreshInterval: 30000
  });

  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = !searchTerm || 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    const matchesPriority = priorityFilter === 'all' || 
      (priorityFilter === 'high' && task.priority >= 0.66) ||
      (priorityFilter === 'medium' && task.priority >= 0.33 && task.priority < 0.66) ||
      (priorityFilter === 'low' && task.priority < 0.33);
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Helper functions
  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckSquare className="w-4 h-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 0.66) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (priority >= 0.33) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 0.66) return 'High';
    if (priority >= 0.33) return 'Medium';
    return 'Low';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  // Form handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTask) {
        await updateTask(editingTask.id, formData);
        setEditingTask(null);
        toast({
          title: 'Success',
          description: 'Task updated successfully'
        });
      } else {
        await createTask(formData);
        toast({
          title: 'Success',
          description: 'Task created successfully'
        });
      }
      
      setShowCreateDialog(false);
      setFormData({
        title: '',
        description: '',
        status: 'pending',
        priority: 0.5,
        due_date: '',
        assigned_agent: ''
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: editingTask ? 'Failed to update task' : 'Failed to create task',
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      assigned_agent: task.assigned_agent || ''
    });
    setShowCreateDialog(true);
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast({
        title: 'Success',
        description: 'Task deleted successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete task',
        variant: 'destructive'
      });
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      if (newStatus === 'completed') {
        await completeTask(taskId);
      } else if (newStatus === 'in_progress') {
        await startTask(taskId);
      } else {
        await updateTask(taskId, { status: newStatus });
      }
      
      toast({
        title: 'Success',
        description: `Task status changed to ${newStatus.replace('_', ' ')}`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <LoadingStates.AI />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-400 mb-4">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p className="text-lg font-medium">Error loading tasks</p>
          <p className="text-sm text-gray-400 mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 flex gap-4 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-900 border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as Task['status'] })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority.toString()} onValueChange={(value) => setFormData({ ...formData, priority: parseFloat(value) })}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.2">Low</SelectItem>
                      <SelectItem value="0.5">Medium</SelectItem>
                      <SelectItem value="0.8">High</SelectItem>
                      <SelectItem value="1">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                
                <div>
                  <Label htmlFor="assigned_agent">Assigned Agent</Label>
                  <Input
                    id="assigned_agent"
                    value={formData.assigned_agent}
                    onChange={(e) => setFormData({ ...formData, assigned_agent: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Agent name"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateDialog(false);
                    setEditingTask(null);
                    setFormData({
                      title: '',
                      description: '',
                      status: 'pending',
                      priority: 0.5,
                      due_date: '',
                      assigned_agent: ''
                    });
                  }}
                  className="border-gray-600 text-gray-400 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {editingTask ? 'Update' : 'Create'} Task
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tasks table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-white/10">
              <th className="pb-3 text-sm font-medium text-gray-400">Task</th>
              <th className="pb-3 text-sm font-medium text-gray-400">Assignee</th>
              <th className="pb-3 text-sm font-medium text-gray-400">Status</th>
              <th className="pb-3 text-sm font-medium text-gray-400">Priority</th>
              <th className="pb-3 text-sm font-medium text-gray-400">Due Date</th>
              <th className="pb-3 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  {tasks.length === 0 ? 'No tasks found. Create your first task!' : 'No tasks match your filters.'}
                </td>
              </tr>
            ) : (
              filteredTasks.map((task: Task) => (
                <tr key={task.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-4">
                    <div>
                      <h4 className="text-white font-medium">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">{task.assigned_agent || 'Unassigned'}</span>
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <span className="text-sm text-gray-300 capitalize">
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <Badge 
                      variant="outline" 
                      className={getPriorityColor(task.priority)}
                    >
                      {getPriorityLabel(task.priority)}
                    </Badge>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className={`text-sm ${task.due_date && isOverdue(task.due_date) && task.status !== 'completed' ? 'text-red-400' : 'text-gray-300'}`}>
                        {task.due_date ? formatDate(task.due_date) : 'No due date'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                        <DropdownMenuItem onClick={() => handleEdit(task)} className="text-white hover:bg-gray-700">
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {task.status === 'pending' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'in_progress')} className="text-white hover:bg-gray-700">
                            <Clock className="w-4 h-4 mr-2" />
                            Start
                          </DropdownMenuItem>
                        )}
                        {task.status !== 'completed' && (
                          <DropdownMenuItem onClick={() => handleStatusChange(task.id, 'completed')} className="text-white hover:bg-gray-700">
                            <CheckSquare className="w-4 h-4 mr-2" />
                            Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDelete(task.id)} className="text-red-400 hover:bg-gray-700">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}