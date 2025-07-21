import React, { useState, useMemo } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { InteractiveCalendar } from '@/components/calendar/InteractiveCalendar';
import { CalendarEvent } from '@/lib/services/microsoft-graph';
import { toast } from '@/hooks/use-toast';
import type { Task } from '@/lib/supabase/task-service';

export function TaskCalendar() {
  const { tasks, updateTask, completeTask, startTask } = useTasks();

  // Convert tasks to the format expected by InteractiveCalendar
  const calendarTasks = useMemo(() => {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      dueDate: task.due_date ? new Date(task.due_date) : new Date(),
      priority: task.priority >= 0.66 ? 'high' as const : 
                task.priority >= 0.33 ? 'medium' as const : 'low' as const,
      status: task.status as 'pending' | 'in_progress' | 'completed',
      calendarEventId: undefined // This will be populated when synced
    }));
  }, [tasks]);

  const handleTaskUpdate = async (taskId: string, updates: Partial<any>) => {
    try {
      await updateTask(taskId, updates);
      toast({
        title: 'Success',
        description: 'Task updated successfully'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  };

  const handleEventCreate = async (event: Omit<CalendarEvent, 'id'>) => {
    // This will be handled by the InteractiveCalendar component
    toast({
      title: 'Event Created',
      description: 'Calendar event created successfully'
    });
  };

  const handleEventUpdate = async (eventId: string, updates: Partial<CalendarEvent>) => {
    // This will be handled by the InteractiveCalendar component
    toast({
      title: 'Event Updated',
      description: 'Calendar event updated successfully'
    });
  };

  const handleEventDelete = async (eventId: string) => {
    // This will be handled by the InteractiveCalendar component
    toast({
      title: 'Event Deleted',
      description: 'Calendar event deleted successfully'
    });
  };

  return (
    <InteractiveCalendar
      tasks={calendarTasks}
      onTaskUpdate={handleTaskUpdate}
      onEventCreate={handleEventCreate}
      onEventUpdate={handleEventUpdate}
      onEventDelete={handleEventDelete}
    />
  );
}