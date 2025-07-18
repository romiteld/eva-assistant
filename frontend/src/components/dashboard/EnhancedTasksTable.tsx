'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User, 
  Plus, 
  Edit3, 
  Trash2, 
  MessageSquare, 
  Paperclip,
  Search,
  Filter,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  assigned_agent: string | null;
  category: string | null;
  tags: string[];
  estimated_hours: number | null;
  actual_hours: number | null;
  completion_percentage: number;
  parent_task_id: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // From the view
  comment_count: number;
  attachment_count: number;
  subtask_count: number;
  total_logged_hours: number;
  is_overdue: boolean;
  is_due_soon: boolean;
}

interface TaskFilters {
  search: string;
  status: string;
  category: string;
  priority_min: string;
  priority_max: string;
  assigned_agent: string;
}

interface TaskSort {
  field: 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'title';
  order: 'asc' | 'desc';
}

interface EnhancedTasksTableProps {
  onTaskCreate?: () => void;
  onTaskEdit?: (task: Task) => void;
  onTaskView?: (task: Task) => void;
}

export function EnhancedTasksTable({ 
  onTaskCreate, 
  onTaskEdit, 
  onTaskView 
}: EnhancedTasksTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    status: '',
    category: '',
    priority_min: '',
    priority_max: '',
    assigned_agent: '',
  });
  const [sort, setSort] = useState<TaskSort>({
    field: 'created_at',
    order: 'desc'
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  
  const { toast } = useToast();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort_by: sort.field,
        sort_order: sort.order,
      });

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          params.append(key, value);
        }
      });

      const response = await fetch(`/api/tasks?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
      setTotalPages(data.pagination?.pages || 1);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [filters, sort, page, toast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleFilterChange = (key: keyof TaskFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handleSortChange = (field: TaskSort['field']) => {
    setSort(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task status');
      }

      await fetchTasks(); // Refresh the list
      toast({
        title: 'Success',
        description: 'Task status updated successfully',
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      await fetchTasks(); // Refresh the list
      toast({
        title: 'Success',
        description: 'Task deleted successfully',
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete task';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckSquare className="w-4 h-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 7) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (priority >= 4) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 7) return 'High';
    if (priority >= 4) return 'Medium';
    return 'Low';
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'No due date';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatRelativeTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffInHours = (now.getTime() - then.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with search and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-400"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-white/5 border-white/10 hover:bg-white/10"
          >
            <Filter className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={onTaskCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
          <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Category"
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="bg-white/5 border-white/10"
          />

          <Select value={filters.priority_min} onValueChange={(value) => handleFilterChange('priority_min', value)}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue placeholder="Min Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              <SelectItem value="0">Low (0-3)</SelectItem>
              <SelectItem value="4">Medium (4-6)</SelectItem>
              <SelectItem value="7">High (7-10)</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Assigned Agent"
            value={filters.assigned_agent}
            onChange={(e) => handleFilterChange('assigned_agent', e.target.value)}
            className="bg-white/5 border-white/10"
          />

          <Button
            variant="outline"
            onClick={() => setFilters({
              search: '',
              status: '',
              category: '',
              priority_min: '',
              priority_max: '',
              assigned_agent: '',
            })}
            className="bg-white/5 border-white/10 hover:bg-white/10"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Tasks Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-white/5">
              <TableHead 
                className="text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSortChange('title')}
              >
                <div className="flex items-center gap-1">
                  Task
                  {sort.field === 'title' && (
                    sort.order === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-gray-400">Status</TableHead>
              <TableHead 
                className="text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSortChange('priority')}
              >
                <div className="flex items-center gap-1">
                  Priority
                  {sort.field === 'priority' && (
                    sort.order === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="text-gray-400 cursor-pointer hover:text-white"
                onClick={() => handleSortChange('due_date')}
              >
                <div className="flex items-center gap-1">
                  Due Date
                  {sort.field === 'due_date' && (
                    sort.order === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </TableHead>
              <TableHead className="text-gray-400">Progress</TableHead>
              <TableHead className="text-gray-400">Activity</TableHead>
              <TableHead className="text-gray-400 w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow 
                key={task.id} 
                className="border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => onTaskView?.(task)}
              >
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        "font-medium max-w-xs truncate",
                        task.is_overdue ? "text-red-400" : "text-white"
                      )}>
                        {task.title}
                      </h4>
                      {task.is_overdue && (
                        <Badge variant="destructive" className="text-xs">
                          Overdue
                        </Badge>
                      )}
                      {task.is_due_soon && !task.is_overdue && (
                        <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400">
                          Due Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 max-w-xs truncate">
                      {task.description || 'No description'}
                    </p>
                    {task.category && (
                      <Badge variant="outline" className="text-xs">
                        {task.category}
                      </Badge>
                    )}
                    {task.tags.length > 0 && (
                      <div className="flex gap-1">
                        {task.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {task.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{task.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(task.status)}
                    <span className="text-sm text-gray-300 capitalize">
                      {task.status.replace('_', ' ')}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={getPriorityColor(task.priority)}
                  >
                    {getPriorityLabel(task.priority)} ({task.priority})
                  </Badge>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className={cn(
                      "text-sm",
                      task.is_overdue ? "text-red-400" : 
                      task.is_due_soon ? "text-yellow-400" : "text-gray-300"
                    )}>
                      {formatDate(task.due_date)}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all"
                          style={{ width: `${task.completion_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400">
                        {task.completion_percentage}%
                      </span>
                    </div>
                    {task.estimated_hours && (
                      <div className="text-xs text-gray-400">
                        {task.total_logged_hours}h / {task.estimated_hours}h
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {task.comment_count > 0 && (
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {task.comment_count}
                      </div>
                    )}
                    {task.attachment_count > 0 && (
                      <div className="flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        {task.attachment_count}
                      </div>
                    )}
                    {task.subtask_count > 0 && (
                      <div className="flex items-center gap-1">
                        <Square className="w-3 h-3" />
                        {task.subtask_count}
                      </div>
                    )}
                    <div>{formatRelativeTime(task.updated_at)}</div>
                  </div>
                </TableCell>

                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-gray-400 hover:text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTaskEdit?.(task); }}>
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator className="bg-gray-700" />
                      
                      {task.status === 'pending' && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'in_progress'); }}>
                          <Play className="h-4 w-4 mr-2" />
                          Start Task
                        </DropdownMenuItem>
                      )}
                      
                      {task.status === 'in_progress' && (
                        <>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'completed'); }}>
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Mark Complete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'pending'); }}>
                            <Pause className="h-4 w-4 mr-2" />
                            Pause Task
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {task.status === 'completed' && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'in_progress'); }}>
                          <Clock className="h-4 w-4 mr-2" />
                          Reopen Task
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator className="bg-gray-700" />
                      
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                        className="text-red-400 focus:text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="bg-white/5 border-white/10 hover:bg-white/10"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="bg-white/5 border-white/10 hover:bg-white/10"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-400">
          <p>No tasks found. Create your first task to get started!</p>
        </div>
      )}
    </div>
  );
}