import React, { useState, useMemo } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckSquare, Clock, AlertCircle, Calendar as CalendarIcon, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

export function TaskCalendar() {
  const { tasks, updateTask, completeTask, startTask } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get tasks for the current month
  const monthTasks = useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    return tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      return taskDate >= startOfMonth && taskDate <= endOfMonth;
    });
  }, [tasks, currentDate]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: { [key: string]: Task[] } = {};
    monthTasks.forEach(task => {
      if (task.due_date) {
        const dateKey = new Date(task.due_date).toDateString();
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(task);
      }
    });
    return grouped;
  }, [monthTasks]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowTaskDialog(true);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  };

  const getTasksForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return tasksByDate[date.toDateString()] || [];
  };

  const isToday = (day: number) => {
    const today = new Date();
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.toDateString() === today.toDateString();
  };

  const isOverdue = (task: Task) => {
    if (!task.due_date) return false;
    const taskDate = new Date(task.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return taskDate < today && task.status !== 'completed';
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
      setShowTaskDialog(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task status',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckSquare className="w-3 h-3 text-green-400" />;
      case 'in_progress':
        return <Clock className="w-3 h-3 text-blue-400" />;
      case 'pending':
        return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      case 'cancelled':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
    }
  };

  const getPriorityLabel = (priority: number) => {
    if (priority >= 0.66) return 'High';
    if (priority >= 0.33) return 'Medium';
    return 'Low';
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 0.66) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (priority >= 0.33) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  const getTaskColor = (task: Task) => {
    if (task.status === 'completed') return 'bg-green-500/20 border-green-500/30';
    if (task.status === 'in_progress') return 'bg-blue-500/20 border-blue-500/30';
    if (isOverdue(task)) return 'bg-red-500/20 border-red-500/30';
    if (task.priority >= 0.66) return 'bg-yellow-500/20 border-yellow-500/30';
    return 'bg-gray-500/20 border-gray-500/30';
  };

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      <Card className="bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" />
              Task Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="border-gray-600 text-gray-400 hover:bg-gray-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-white font-semibold text-lg min-w-48 text-center">
                {formatDate(currentDate)}
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="border-gray-600 text-gray-400 hover:bg-gray-700"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-white/5 rounded-lg p-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`
                    min-h-24 p-2 border border-white/10 rounded-lg
                    ${day ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-800/50'}
                    ${day && isToday(day) ? 'bg-purple-500/20 border-purple-500/50' : ''}
                    transition-colors cursor-pointer
                  `}
                >
                  {day && (
                    <>
                      <div className="text-sm text-white font-medium mb-1">{day}</div>
                      <div className="space-y-1">
                        {getTasksForDay(day).slice(0, 3).map(task => (
                          <div
                            key={task.id}
                            onClick={() => handleTaskClick(task)}
                            className={`
                              text-xs p-1 rounded border cursor-pointer
                              ${getTaskColor(task)}
                              hover:opacity-80 transition-opacity
                            `}
                          >
                            <div className="flex items-center gap-1">
                              {getStatusIcon(task.status)}
                              <span className="truncate text-white">{task.title}</span>
                            </div>
                          </div>
                        ))}
                        {getTasksForDay(day).length > 3 && (
                          <div className="text-xs text-gray-400 pl-1">
                            +{getTasksForDay(day).length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Details Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className="text-gray-400 mt-2">{selectedTask.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedTask.status)}
                    <span className="text-white capitalize">
                      {selectedTask.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Priority</label>
                  <div className="mt-1">
                    <Badge 
                      variant="outline" 
                      className={getPriorityColor(selectedTask.priority)}
                    >
                      {getPriorityLabel(selectedTask.priority)}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Due Date</label>
                  <div className="flex items-center gap-2 mt-1">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    <span className={`text-sm ${
                      isOverdue(selectedTask) && selectedTask.status !== 'completed' 
                        ? 'text-red-400' 
                        : 'text-white'
                    }`}>
                      {selectedTask.due_date ? 
                        new Date(selectedTask.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : 'No due date'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Assigned Agent</label>
                  <div className="flex items-center gap-2 mt-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-white text-sm">
                      {selectedTask.assigned_agent || 'Unassigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-700">
                {selectedTask.status === 'pending' && (
                  <Button
                    onClick={() => handleStatusChange(selectedTask.id, 'in_progress')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Start Task
                  </Button>
                )}
                {selectedTask.status !== 'completed' && (
                  <Button
                    onClick={() => handleStatusChange(selectedTask.id, 'completed')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
                <Button
                  onClick={() => setShowTaskDialog(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-400 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}