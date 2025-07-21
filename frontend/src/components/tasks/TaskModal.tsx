'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  CalendarIcon, 
  X, 
  Plus, 
  Clock, 
  Tag, 
  Users,
  Calendar as CalendarCogIcon,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface Task {
  id?: string;
  title: string;
  description: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date: string | null;
  assigned_agent: string | null;
  category: string | null;
  tags: string[];
  estimated_hours: number | null;
  parent_task_id: string | null;
  metadata: any;
}

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => Promise<void>;
  task?: Task | null;
  parentTask?: Task | null;
}

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Low (1)', color: 'bg-green-500/20 text-green-400' },
  { value: 2, label: 'Low (2)', color: 'bg-green-500/20 text-green-400' },
  { value: 3, label: 'Low (3)', color: 'bg-green-500/20 text-green-400' },
  { value: 4, label: 'Medium (4)', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 5, label: 'Medium (5)', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 6, label: 'Medium (6)', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 7, label: 'High (7)', color: 'bg-red-500/20 text-red-400' },
  { value: 8, label: 'High (8)', color: 'bg-red-500/20 text-red-400' },
  { value: 9, label: 'High (9)', color: 'bg-red-500/20 text-red-400' },
  { value: 10, label: 'Urgent (10)', color: 'bg-red-600/20 text-red-300' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: '⏳' },
  { value: 'in_progress', label: 'In Progress', icon: '🔄' },
  { value: 'completed', label: 'Completed', icon: '✅' },
  { value: 'cancelled', label: 'Cancelled', icon: '❌' },
];

const CATEGORY_OPTIONS = [
  'Work',
  'Personal',
  'Projects',
  'Meetings',
  'Research',
  'Administrative',
  'Planning',
  'Review',
  'Development',
  'Client Work',
];

const AGENT_OPTIONS = [
  'lead-generation',
  'content-studio',
  'deep-thinking',
  'recruiter-intel',
  'resume-parser',
  'outreach-campaign',
  'interview-center',
  'data-agent',
  'workflow-agent',
  'linkedin-enrichment',
];

export function TaskModal({ isOpen, onClose, onSave, task, parentTask }: TaskModalProps) {
  const [loading, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    priority: 5,
    status: 'pending',
    due_date: null,
    assigned_agent: null,
    category: null,
    tags: [],
    estimated_hours: null,
    parent_task_id: parentTask?.id || null,
    metadata: {},
  });
  const [newTag, setNewTag] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState('09:00');
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);
  const [calendarConflicts, setCalendarConflicts] = useState<any[]>([]);

  const { toast } = useToast();

  // Initialize form data when task changes
  useEffect(() => {
    if (task) {
      setFormData({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        due_date: task.due_date,
        assigned_agent: task.assigned_agent,
        category: task.category,
        tags: task.tags || [],
        estimated_hours: task.estimated_hours,
        parent_task_id: task.parent_task_id,
        metadata: task.metadata || {},
      });
      
      if (task.due_date) {
        const date = new Date(task.due_date);
        setDueDate(date);
        setDueTime(format(date, 'HH:mm'));
      }
    } else {
      // Reset for new task
      setFormData({
        title: '',
        description: '',
        priority: 5,
        status: 'pending',
        due_date: null,
        assigned_agent: null,
        category: null,
        tags: [],
        estimated_hours: null,
        parent_task_id: parentTask?.id || null,
        metadata: {},
      });
      setDueDate(undefined);
      setDueTime('09:00');
      setAddToCalendar(true);
    }
  }, [task, parentTask]);

  // Check for calendar conflicts when due date changes
  const checkCalendarConflicts = useCallback(async () => {
    if (!dueDate) return;
    
    try {
      const startTime = new Date(dueDate);
      const [hours, minutes] = dueTime.split(':');
      startTime.setHours(parseInt(hours), parseInt(minutes));
      
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + (formData.estimated_hours || 1));

      const response = await fetch('/api/microsoft/calendar/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        }),
      });

      if (response.ok) {
        const conflicts = await response.json();
        setCalendarConflicts(conflicts.events || []);
      }
    } catch (error) {
      console.error('Failed to check calendar conflicts:', error);
    }
  }, [dueDate, dueTime, formData.estimated_hours]);

  useEffect(() => {
    if (dueDate && addToCalendar) {
      checkCalendarConflicts();
    }
  }, [dueDate, dueTime, addToCalendar, checkCalendarConflicts]);

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(tag => tag !== tagToRemove) || []
    }));
  };

  const handleDueDateChange = (date: Date | undefined) => {
    setDueDate(date);
    if (date) {
      const [hours, minutes] = dueTime.split(':');
      date.setHours(parseInt(hours), parseInt(minutes));
      setFormData(prev => ({
        ...prev,
        due_date: date.toISOString()
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        due_date: null
      }));
    }
  };

  const handleTimeChange = (time: string) => {
    setDueTime(time);
    if (dueDate) {
      const [hours, minutes] = time.split(':');
      const newDate = new Date(dueDate);
      newDate.setHours(parseInt(hours), parseInt(minutes));
      setFormData(prev => ({
        ...prev,
        due_date: newDate.toISOString()
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title?.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);

    try {
      const taskData = {
        ...formData,
        metadata: {
          ...formData.metadata,
          addToCalendar,
          calendarEventId: formData.metadata?.calendarEventId,
        }
      };

      await onSave(taskData);
      
      // If adding to calendar and we have a due date, create calendar event
      if (addToCalendar && formData.due_date && !task?.id) {
        try {
          await createCalendarEvent(taskData);
        } catch (calError) {
          console.error('Failed to create calendar event:', calError);
          toast({
            title: 'Warning',
            description: 'Task saved but calendar event could not be created',
            variant: 'destructive',
          });
        }
      }

      onClose();
      
    } catch (error) {
      console.error('Failed to save task:', error);
      toast({
        title: 'Error',
        description: 'Failed to save task. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const createCalendarEvent = async (taskData: Partial<Task>) => {
    if (!taskData.due_date) return;

    const startTime = new Date(taskData.due_date);
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + (taskData.estimated_hours || 1));

    const response = await fetch('/api/microsoft/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: taskData.title,
        body: taskData.description || `Task: ${taskData.title}`,
        start: {
          dateTime: startTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        categories: taskData.category ? [taskData.category] : [],
        importance: taskData.priority && taskData.priority >= 7 ? 'high' : taskData.priority && taskData.priority >= 4 ? 'normal' : 'low',
      }),
    });

    if (response.ok) {
      const event = await response.json();
      // Update task metadata with calendar event ID for future syncing
      setFormData(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          calendarEventId: event.id,
        }
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {task ? 'Edit Task' : parentTask ? 'Create Subtask' : 'Create Task'}
            {parentTask && (
              <Badge variant="outline" className="text-xs">
                Subtask of: {parentTask.title}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {task ? 'Update task details and settings' : 'Fill in the details for your new task'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Task title..."
              className="bg-gray-800 border-gray-600 text-white"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Task description..."
              className="bg-gray-800 border-gray-600 text-white min-h-[80px]"
            />
          </div>

          {/* Priority and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select 
                value={formData.priority?.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: parseInt(value) }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', option.color)} />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category and Estimated Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                value={formData.category || ''} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value || null }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No category</SelectItem>
                  {CATEGORY_OPTIONS.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_hours">Estimated Hours</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                min="0"
                value={formData.estimated_hours || ''}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  estimated_hours: e.target.value ? parseFloat(e.target.value) : null 
                }))}
                placeholder="0"
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </div>

          {/* Due Date and Calendar Integration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal bg-gray-800 border-gray-600",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={handleDueDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                {dueDate && (
                  <Input
                    type="time"
                    value={dueTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="w-32 bg-gray-800 border-gray-600 text-white"
                  />
                )}
              </div>
            </div>

            {/* Calendar Integration Options */}
            {dueDate && (
              <div className="space-y-3 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarCogIcon className="h-4 w-4 text-blue-400" />
                    <Label htmlFor="addToCalendar" className="text-sm">Add to Calendar</Label>
                  </div>
                  <Switch
                    id="addToCalendar"
                    checked={addToCalendar}
                    onCheckedChange={setAddToCalendar}
                  />
                </div>
                
                {addToCalendar && calendarConflicts.length > 0 && (
                  <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                    <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
                    <div className="text-sm">
                      <p className="text-yellow-400 font-medium">Calendar Conflicts Detected</p>
                      <p className="text-gray-300 text-xs mt-1">
                        {calendarConflicts.length} existing event(s) overlap with this time.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="flex-1 bg-gray-800 border-gray-600 text-white"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddTag} size="icon" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Agent */}
          <div className="space-y-2">
            <Label>Assigned Agent</Label>
            <Select 
              value={formData.assigned_agent || ''} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_agent: value || null }))}
            >
              <SelectTrigger className="bg-gray-800 border-gray-600">
                <SelectValue placeholder="Select an AI agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No agent assigned</SelectItem>
                {AGENT_OPTIONS.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {agent.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}