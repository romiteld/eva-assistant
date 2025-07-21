'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Edit2, 
  Trash2,
  Clock,
  MapPin,
  Users,
  Link as LinkIcon,
  AlertCircle,
  CheckCircle,
  Settings,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { microsoftGraphService, CalendarEvent, OutlookCalendar } from '@/lib/services/microsoft-graph';
import { useToast } from '@/hooks/use-toast';
import { AccountInfo } from '@azure/msal-browser';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

interface TaskEvent {
  id: string;
  title: string;
  description?: string;
  dueDate: Date;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  calendarEventId?: string;
}

interface InteractiveCalendarProps {
  tasks?: TaskEvent[];
  onTaskUpdate?: (taskId: string, updates: Partial<TaskEvent>) => void;
  onEventCreate?: (event: Omit<CalendarEvent, 'id'>) => void;
  onEventUpdate?: (eventId: string, updates: Partial<CalendarEvent>) => void;
  onEventDelete?: (eventId: string) => void;
}

export function InteractiveCalendar({ 
  tasks = [],
  onTaskUpdate,
  onEventCreate,
  onEventUpdate,
  onEventDelete 
}: InteractiveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<OutlookCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('primary');
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  const { toast } = useToast();

  const [eventForm, setEventForm] = useState({
    subject: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: '',
    importance: 'normal' as 'low' | 'normal' | 'high'
  });

  useEffect(() => {
    checkSignInStatus();
    // checkSignInStatus only needs to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      loadCalendars();
      loadEvents();
    }
    // loadCalendars and loadEvents are defined locally and depend on state/props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, selectedCalendar, currentDate]);

  const checkSignInStatus = async () => {
    try {
      const signedIn = microsoftGraphService.isSignedIn();
      setIsSignedIn(signedIn);
      
      if (signedIn) {
        const currentAccount = microsoftGraphService.getCurrentAccount();
        setAccount(currentAccount);
      }
    } catch (error) {
      console.error('Failed to check sign in status:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const account = await microsoftGraphService.signIn();
      setAccount(account);
      setIsSignedIn(true);
      setShowConnectDialog(false);
      
      toast({
        title: 'Connected to Outlook',
        description: 'Successfully connected to your Outlook calendar',
      });
    } catch (error) {
      console.error('Sign in failed:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Outlook. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await microsoftGraphService.signOut();
      setIsSignedIn(false);
      setAccount(null);
      setEvents([]);
      setCalendars([]);
      
      toast({
        title: 'Disconnected',
        description: 'Successfully disconnected from Outlook',
      });
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const loadCalendars = async () => {
    try {
      const calendarList = await microsoftGraphService.getCalendars();
      setCalendars(calendarList);
      
      if (calendarList.length > 0 && selectedCalendar === 'primary') {
        const defaultCalendar = calendarList.find(c => c.isDefaultCalendar) || calendarList[0];
        setSelectedCalendar(defaultCalendar.id);
      }
    } catch (error) {
      console.error('Failed to load calendars:', error);
    }
  };

  const loadEvents = async () => {
    try {
      setSyncStatus('syncing');
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const calendarEvents = await microsoftGraphService.getCalendarEvents(
        selectedCalendar,
        startOfMonth,
        endOfMonth
      );
      
      setEvents(calendarEvents);
      setSyncStatus('success');
    } catch (error) {
      console.error('Failed to load events:', error);
      setSyncStatus('error');
    }
  };

  const syncTasksWithCalendar = async () => {
    if (!isSignedIn) return;

    try {
      setSyncStatus('syncing');
      
      for (const task of tasks) {
        if (task.dueDate && task.status !== 'completed' && !task.calendarEventId) {
          try {
            const calendarEvent = await microsoftGraphService.createTaskEvent(
              task.title,
              task.description || '',
              task.dueDate,
              task.priority
            );
            
            if (onTaskUpdate) {
              onTaskUpdate(task.id, { calendarEventId: calendarEvent.id });
            }
          } catch (error) {
            console.error(`Failed to sync task ${task.id}:`, error);
          }
        }
      }
      
      await loadEvents();
      setSyncStatus('success');
      
      toast({
        title: 'Sync Complete',
        description: 'Tasks have been synchronized with your Outlook calendar',
      });
    } catch (error) {
      console.error('Failed to sync tasks:', error);
      setSyncStatus('error');
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync tasks with calendar',
        variant: 'destructive',
      });
    }
  };

  const handleCreateEvent = async () => {
    if (!isSignedIn) return;

    try {
      const startDateTime = new Date(`${eventForm.startDate}T${eventForm.startTime}`);
      const endDateTime = new Date(`${eventForm.endDate}T${eventForm.endTime}`);

      const event: Omit<CalendarEvent, 'id'> = {
        subject: eventForm.subject,
        body: {
          content: eventForm.description,
          contentType: 'text'
        },
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        location: eventForm.location ? {
          displayName: eventForm.location
        } : undefined,
        importance: eventForm.importance
      };

      await microsoftGraphService.createCalendarEvent(event, selectedCalendar);
      await loadEvents();
      setShowEventDialog(false);
      resetEventForm();
      
      toast({
        title: 'Event Created',
        description: 'Event has been added to your calendar',
      });
    } catch (error) {
      console.error('Failed to create event:', error);
      toast({
        title: 'Failed to Create Event',
        description: 'Could not create the calendar event',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateEvent = async () => {
    if (!isSignedIn || !editingEvent) return;

    try {
      const startDateTime = new Date(`${eventForm.startDate}T${eventForm.startTime}`);
      const endDateTime = new Date(`${eventForm.endDate}T${eventForm.endTime}`);

      const updates: Partial<CalendarEvent> = {
        subject: eventForm.subject,
        body: {
          content: eventForm.description,
          contentType: 'text'
        },
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        location: eventForm.location ? {
          displayName: eventForm.location
        } : undefined,
        importance: eventForm.importance
      };

      await microsoftGraphService.updateCalendarEvent(editingEvent.id!, updates, selectedCalendar);
      await loadEvents();
      setShowEventDialog(false);
      setEditingEvent(null);
      resetEventForm();
      
      toast({
        title: 'Event Updated',
        description: 'Event has been updated in your calendar',
      });
    } catch (error) {
      console.error('Failed to update event:', error);
      toast({
        title: 'Failed to Update Event',
        description: 'Could not update the calendar event',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!isSignedIn) return;

    try {
      await microsoftGraphService.deleteCalendarEvent(eventId, selectedCalendar);
      await loadEvents();
      
      toast({
        title: 'Event Deleted',
        description: 'Event has been removed from your calendar',
      });
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast({
        title: 'Failed to Delete Event',
        description: 'Could not delete the calendar event',
        variant: 'destructive',
      });
    }
  };

  const resetEventForm = () => {
    setEventForm({
      subject: '',
      description: '',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      location: '',
      importance: 'normal'
    });
  };

  const openEventDialog = (date?: Date) => {
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      setEventForm(prev => ({
        ...prev,
        startDate: dateStr,
        endDate: dateStr,
        startTime: '09:00',
        endTime: '10:00'
      }));
    }
    setShowEventDialog(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEvent(event);
    const startDate = new Date(event.start.dateTime);
    const endDate = new Date(event.end.dateTime);
    
    setEventForm({
      subject: event.subject,
      description: event.body.content,
      startDate: startDate.toISOString().split('T')[0],
      startTime: startDate.toTimeString().slice(0, 5),
      endDate: endDate.toISOString().split('T')[0],
      endTime: endDate.toTimeString().slice(0, 5),
      location: event.location?.displayName || '',
      importance: event.importance || 'normal'
    });
    setShowEventDialog(true);
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());
    
    const days: CalendarDay[] = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.start.dateTime);
        return eventDate.toDateString() === date.toDateString();
      });
      
      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.toDateString() === today.toDateString(),
        events: dayEvents
      });
    }
    
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.categories?.includes('Task')) return 'bg-purple-500';
    if (event.importance === 'high') return 'bg-red-500';
    if (event.importance === 'low') return 'bg-gray-500';
    return 'bg-blue-500';
  };

  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg">
            <CalendarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Interactive Calendar</h2>
            {isSignedIn && account && (
              <p className="text-sm text-gray-400">Connected as {account.username}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isSignedIn && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={syncTasksWithCalendar}
                disabled={syncStatus === 'syncing'}
                className="border-white/20 text-white hover:bg-white/10"
              >
                {getSyncStatusIcon()}
                <span className="ml-2">Sync Tasks</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openEventDialog()}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </>
          )}
          
          {!isSignedIn && (
            <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect Outlook
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-700 text-white">
                <DialogHeader>
                  <DialogTitle>Connect to Outlook Calendar</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-gray-300">
                    Connect your Outlook calendar to sync tasks and manage events directly from the dashboard.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Read and write calendar events</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Sync task due dates</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Create and manage events</span>
                  </div>
                  <Button
                    onClick={handleSignIn}
                    disabled={loading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-4 h-4 mr-2" />
                        Connect to Outlook
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isSignedIn ? (
        <>
          {/* Calendar Navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="text-lg font-medium text-white min-w-[200px] text-center">
                {formatMonth(currentDate)}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="border-white/20 text-white hover:bg-white/10"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            {calendars.length > 1 && (
              <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
                <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Select Calendar" />
                </SelectTrigger>
                <SelectContent>
                  {calendars.map((calendar) => (
                    <SelectItem key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
                {day}
              </div>
            ))}
            
            {generateCalendarDays().map((day, index) => (
              <motion.div
                key={index}
                className={cn(
                  "min-h-[80px] p-2 border border-white/5 rounded-lg cursor-pointer transition-colors",
                  day.isCurrentMonth ? "bg-white/5 hover:bg-white/10" : "bg-white/2",
                  day.isToday && "ring-2 ring-purple-500"
                )}
                onClick={() => openEventDialog(day.date)}
                whileHover={{ scale: 1.02 }}
              >
                <div className={cn(
                  "text-sm font-medium mb-1",
                  day.isCurrentMonth ? "text-white" : "text-gray-500",
                  day.isToday && "text-purple-300"
                )}>
                  {day.date.getDate()}
                </div>
                <div className="space-y-1">
                  {day.events.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={cn(
                        "text-xs p-1 rounded text-white truncate",
                        getEventColor(event)
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(event);
                      }}
                    >
                      {event.subject}
                    </div>
                  ))}
                  {day.events.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{day.events.length - 2} more
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Event Dialog */}
          <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
            <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? 'Edit Event' : 'Create Event'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="subject">Title</Label>
                  <Input
                    id="subject"
                    value={eventForm.subject}
                    onChange={(e) => setEventForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Event title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={eventForm.description}
                    onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Event description"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={eventForm.startDate}
                      onChange={(e) => setEventForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={eventForm.endDate}
                      onChange={(e) => setEventForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={eventForm.location}
                    onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white"
                    placeholder="Event location"
                  />
                </div>
                
                <div>
                  <Label htmlFor="importance">Priority</Label>
                  <Select value={eventForm.importance} onValueChange={(value) => setEventForm(prev => ({ ...prev, importance: value as 'low' | 'normal' | 'high' }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEventDialog(false);
                      setEditingEvent(null);
                      resetEventForm();
                    }}
                    className="border-gray-600 text-gray-400 hover:bg-gray-700"
                  >
                    Cancel
                  </Button>
                  {editingEvent && (
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteEvent(editingEvent.id!)}
                      className="border-red-600 text-red-400 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                  <Button
                    onClick={editingEvent ? handleUpdateEvent : handleCreateEvent}
                    disabled={!eventForm.subject || !eventForm.startDate || !eventForm.endDate}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {editingEvent ? 'Update' : 'Create'} Event
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center">
            <CalendarIcon className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            Connect Your Outlook Calendar
          </h3>
          <p className="text-gray-400 mb-4">
            Sync your tasks with Outlook and manage your schedule in one place
          </p>
          <Button
            onClick={() => setShowConnectDialog(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Connect Calendar
          </Button>
        </div>
      )}
    </div>
  );
}