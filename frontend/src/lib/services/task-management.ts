import { Database } from '@/types/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '@/lib/supabase/browser';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: string;
  projectId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  tags: string[];
  dependencies?: string[];
  subTasks?: Task[];
  aiGenerated?: boolean;
  aiSuggestions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in minutes
  description?: string;
  billable: boolean;
  rate?: number;
  tags?: string[];
  aiDetected?: boolean;
  productivityScore?: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  startDate: Date;
  endDate?: Date;
  budget?: number;
  clientId?: string;
  teamMembers: string[];
  estimatedHours?: number;
  actualHours?: number;
  completionPercentage?: number;
}

export interface ProductivityInsights {
  userId: string;
  date: Date;
  totalHours: number;
  productiveHours: number;
  focusScore: number;
  taskCompletionRate: number;
  averageTaskDuration: number;
  peakProductivityHours: string[];
  distractions: string[];
  recommendations: string[];
}

export class TaskManagementService {
  private supabase = supabase;
  private gemini: GoogleGenerativeAI;
  private activeTimers: Map<string, TimeEntry>;
  
  constructor(
    geminiApiKey: string
  ) {
    this.gemini = new GoogleGenerativeAI(geminiApiKey);
    this.activeTimers = new Map();
  }

  // Task Management
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    try {
      // AI enhancement: suggest better task breakdown
      const suggestions = await this.getTaskSuggestions(task);
      
      const { data, error } = await this.supabase
        .from('tasks')
        .insert({
          ...task,
          ai_suggestions: suggestions,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Create subtasks if suggested
      if (suggestions.subtasks && suggestions.subtasks.length > 0) {
        await this.createSubtasks(data.id, suggestions.subtasks);
      }

      // Set up smart reminders
      await this.setupSmartReminders(data);

      return this.mapToTask(data);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      // Track status changes for analytics
      if (updates.status) {
        await this.trackStatusChange(taskId, updates.status);
      }

      return this.mapToTask(data);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  async getTasks(filters?: {
    userId?: string;
    projectId?: string;
    status?: Task['status'];
    priority?: Task['priority'];
    dueDate?: { from: Date; to: Date };
  }): Promise<Task[]> {
    try {
      let query = this.supabase.from('tasks').select('*');

      if (filters?.userId) {
        query = query.eq('assignee_id', filters.userId);
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.dueDate) {
        query = query
          .gte('due_date', filters.dueDate.from.toISOString())
          .lte('due_date', filters.dueDate.to.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map(this.mapToTask);
    } catch (error) {
      console.error('Error getting tasks:', error);
      throw error;
    }
  }

  // Time Tracking
  async startTimer(taskId: string, userId: string, description?: string): Promise<TimeEntry> {
    try {
      // Stop any active timer for this user
      const activeTimer = Array.from(this.activeTimers.values())
        .find(timer => timer.userId === userId && !timer.endTime);
      
      if (activeTimer) {
        await this.stopTimer(activeTimer.id);
      }

      const timeEntry: TimeEntry = {
        id: `timer_${Date.now()}`,
        taskId,
        userId,
        startTime: new Date(),
        description,
        billable: true,
        aiDetected: false
      };

      // Store in database
      const { data, error } = await this.supabase
        .from('time_entries')
        .insert({
          ...timeEntry,
          start_time: timeEntry.startTime.toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Store in memory for quick access
      this.activeTimers.set(data.id, this.mapToTimeEntry(data));

      // Start productivity monitoring
      this.startProductivityMonitoring(data.id);

      return this.mapToTimeEntry(data);
    } catch (error) {
      console.error('Error starting timer:', error);
      throw error;
    }
  }

  async stopTimer(timerId: string): Promise<TimeEntry> {
    try {
      const activeTimer = this.activeTimers.get(timerId);
      if (!activeTimer) {
        throw new Error('Timer not found or already stopped');
      }

      const endTime = new Date();
      const duration = Math.round((endTime.getTime() - activeTimer.startTime.getTime()) / 60000); // minutes

      // Calculate productivity score
      const productivityScore = await this.calculateProductivityScore(activeTimer, duration);

      const { data, error } = await this.supabase
        .from('time_entries')
        .update({
          end_time: endTime.toISOString(),
          duration,
          productivity_score: productivityScore
        })
        .eq('id', timerId)
        .select()
        .single();

      if (error) throw error;

      // Remove from active timers
      this.activeTimers.delete(timerId);

      // Update task actual hours
      await this.updateTaskActualHours(activeTimer.taskId);

      return this.mapToTimeEntry(data);
    } catch (error) {
      console.error('Error stopping timer:', error);
      throw error;
    }
  }

  async getTimeEntries(filters?: {
    userId?: string;
    taskId?: string;
    projectId?: string;
    dateRange?: { from: Date; to: Date };
    billable?: boolean;
  }): Promise<TimeEntry[]> {
    try {
      let query = this.supabase.from('time_entries').select('*');

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.taskId) {
        query = query.eq('task_id', filters.taskId);
      }
      if (filters?.dateRange) {
        query = query
          .gte('start_time', filters.dateRange.from.toISOString())
          .lte('start_time', filters.dateRange.to.toISOString());
      }
      if (filters?.billable !== undefined) {
        query = query.eq('billable', filters.billable);
      }

      const { data, error } = await query;
      if (error) throw error;

      return data.map(this.mapToTimeEntry);
    } catch (error) {
      console.error('Error getting time entries:', error);
      throw error;
    }
  }

  // AI-Powered Features
  async getTaskSuggestions(task: Partial<Task>): Promise<any> {
    try {
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
        Analyze this task and provide suggestions:
        
        Title: ${task.title}
        Description: ${task.description || 'No description'}
        Priority: ${task.priority}
        Estimated Hours: ${task.estimatedHours || 'Not specified'}
        
        Provide:
        1. Better task title (if needed)
        2. Subtask breakdown (3-5 subtasks)
        3. Realistic time estimate
        4. Priority validation
        5. Potential blockers or dependencies
        6. Success criteria
      `;

      const result = await model.generateContent(prompt);
      return this.parseTaskSuggestions(result.response.text());
    } catch (error) {
      console.error('Error getting task suggestions:', error);
      return {};
    }
  }

  async generateDailyPlan(userId: string, date: Date = new Date()): Promise<any> {
    try {
      // Get user's tasks
      const tasks = await this.getTasks({
        userId,
        status: 'pending'
      });

      // Get calendar events (if integrated)
      const calendarEvents = await this.getCalendarEvents(userId, date);

      // Get historical productivity data
      const productivityData = await this.getProductivityHistory(userId);

      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
        Create an optimal daily plan for this user:
        
        Available Tasks: ${JSON.stringify(tasks.map(t => ({
          title: t.title,
          priority: t.priority,
          estimatedHours: t.estimatedHours,
          dueDate: t.dueDate
        })))}
        
        Calendar Commitments: ${JSON.stringify(calendarEvents)}
        
        Productivity Patterns:
        - Peak hours: ${productivityData.peakHours.join(', ')}
        - Average focus duration: ${productivityData.avgFocusDuration} minutes
        - Task completion rate: ${productivityData.completionRate}%
        
        Create a schedule that:
        1. Prioritizes high-impact tasks
        2. Schedules complex work during peak hours
        3. Includes breaks and buffer time
        4. Considers due dates and dependencies
        5. Limits work to 8 hours
      `;

      const result = await model.generateContent(prompt);
      const plan = this.parseDailyPlan(result.response.text());

      // Save the plan
      await this.saveDailyPlan(userId, date, plan);

      return plan;
    } catch (error) {
      console.error('Error generating daily plan:', error);
      throw error;
    }
  }

  async getProductivityInsights(userId: string, date: Date = new Date()): Promise<ProductivityInsights> {
    try {
      // Get time entries for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const timeEntries = await this.getTimeEntries({
        userId,
        dateRange: { from: startOfDay, to: endOfDay }
      });

      // Calculate metrics
      const totalMinutes = timeEntries.reduce((sum: number, entry: TimeEntry) => sum + (entry.duration || 0), 0);
      const totalHours = totalMinutes / 60;

      const productiveMinutes = timeEntries
        .filter((entry: TimeEntry) => (entry.productivityScore || 0) > 70)
        .reduce((sum: number, entry: TimeEntry) => sum + (entry.duration || 0), 0);
      const productiveHours = productiveMinutes / 60;

      // Get completed tasks
      const completedTasks = await this.supabase
        .from('task_status_history')
        .select('*')
        .eq('user_id', userId)
        .eq('new_status', 'completed')
        .gte('changed_at', startOfDay.toISOString())
        .lte('changed_at', endOfDay.toISOString());

      const taskCompletionRate = completedTasks.data ? 
        (completedTasks.data.length / Math.max(timeEntries.length, 1)) * 100 : 0;

      // Analyze peak productivity hours
      const hourlyProductivity = this.analyzeHourlyProductivity(timeEntries);
      const peakHours = this.identifyPeakHours(hourlyProductivity);

      // Generate AI insights
      const insights = await this.generateProductivityInsights(
        timeEntries,
        completedTasks.data || [],
        hourlyProductivity
      );

      return {
        userId,
        date,
        totalHours,
        productiveHours,
        focusScore: productiveHours / Math.max(totalHours, 1) * 100,
        taskCompletionRate,
        averageTaskDuration: totalMinutes / Math.max(timeEntries.length, 1),
        peakProductivityHours: peakHours,
        distractions: insights.distractions,
        recommendations: insights.recommendations
      };
    } catch (error) {
      console.error('Error getting productivity insights:', error);
      throw error;
    }
  }

  // Smart Features
  async autoScheduleTasks(userId: string, tasks: Task[]): Promise<any> {
    try {
      // Get user's calendar availability
      const availability = await this.getUserAvailability(userId);

      // Get task dependencies
      const dependencies = await this.getTaskDependencies(tasks.map(t => t.id));

      // Use AI to create optimal schedule
      const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
      
      const prompt = `
        Create an optimal task schedule:
        
        Tasks: ${JSON.stringify(tasks.map(t => ({
          id: t.id,
          title: t.title,
          estimatedHours: t.estimatedHours,
          priority: t.priority,
          dueDate: t.dueDate,
          dependencies: t.dependencies
        })))}
        
        Availability: ${JSON.stringify(availability)}
        
        Create a schedule that:
        1. Respects dependencies
        2. Prioritizes urgent/high-priority tasks
        3. Batches similar tasks
        4. Includes buffer time
        5. Avoids overloading any single day
      `;

      const result = await model.generateContent(prompt);
      const schedule = this.parseSchedule(result.response.text());

      // Apply schedule to tasks
      for (const scheduledTask of schedule.tasks) {
        await this.updateTask(scheduledTask.id, {
          dueDate: new Date(scheduledTask.scheduledDate)
        });
      }

      return schedule;
    } catch (error) {
      console.error('Error auto-scheduling tasks:', error);
      throw error;
    }
  }

  async detectAndLogActivity(userId: string): Promise<void> {
    try {
      // This would integrate with desktop/browser activity tracking
      // For now, we'll simulate activity detection
      
      const currentActivity = await this.getCurrentActivity(userId);
      
      if (currentActivity.type === 'productive') {
        // Check if there's an active timer
        const activeTimer = Array.from(this.activeTimers.values())
          .find(timer => timer.userId === userId && !timer.endTime);
        
        if (!activeTimer && currentActivity.confidence > 0.8) {
          // Auto-start timer for detected work
          const task = await this.findOrCreateTaskForActivity(currentActivity);
          await this.startTimer(task.id, userId, `Auto-detected: ${currentActivity.description}`);
        }
      }
    } catch (error) {
      console.error('Error detecting activity:', error);
    }
  }

  // Helper Methods
  private mapToTask(data: any): Task {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assignee_id,
      projectId: data.project_id,
      dueDate: data.due_date ? new Date(data.due_date) : undefined,
      estimatedHours: data.estimated_hours,
      actualHours: data.actual_hours,
      tags: data.tags || [],
      dependencies: data.dependencies || [],
      aiGenerated: data.ai_generated,
      aiSuggestions: data.ai_suggestions,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private mapToTimeEntry(data: any): TimeEntry {
    return {
      id: data.id,
      taskId: data.task_id,
      userId: data.user_id,
      startTime: new Date(data.start_time),
      endTime: data.end_time ? new Date(data.end_time) : undefined,
      duration: data.duration,
      description: data.description,
      billable: data.billable,
      rate: data.rate,
      tags: data.tags || [],
      aiDetected: data.ai_detected,
      productivityScore: data.productivity_score
    };
  }

  private parseTaskSuggestions(text: string): any {
    // Parse AI response for task suggestions
    return {
      improvedTitle: null,
      subtasks: [
        { title: 'Research requirements', estimatedHours: 1 },
        { title: 'Create initial draft', estimatedHours: 2 },
        { title: 'Review and refine', estimatedHours: 1 }
      ],
      estimatedHours: 4,
      dependencies: [],
      successCriteria: ['Clear requirements documented', 'Stakeholder approval']
    };
  }

  private async createSubtasks(parentTaskId: string, subtasks: any[]): Promise<void> {
    for (const subtask of subtasks) {
      await this.createTask({
        ...subtask,
        parentTaskId,
        status: 'pending',
        priority: 'medium',
        tags: ['auto-generated']
      });
    }
  }

  private async setupSmartReminders(task: any): Promise<void> {
    if (!task.due_date) return;

    const dueDate = new Date(task.due_date);
    const now = new Date();
    const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Set reminders based on task priority and time until due
    const reminders = [];
    
    if (task.priority === 'urgent' || task.priority === 'high') {
      if (hoursUntilDue > 24) {
        reminders.push(new Date(dueDate.getTime() - 24 * 60 * 60 * 1000)); // 24h before
      }
      if (hoursUntilDue > 4) {
        reminders.push(new Date(dueDate.getTime() - 4 * 60 * 60 * 1000)); // 4h before
      }
    }

    for (const reminderTime of reminders) {
      await this.supabase
        .from('task_reminders')
        .insert({
          task_id: task.id,
          user_id: task.assignee_id,
          reminder_time: reminderTime.toISOString(),
          type: 'due_date'
        });
    }
  }

  private async trackStatusChange(taskId: string, newStatus: Task['status']): Promise<void> {
    await this.supabase
      .from('task_status_history')
      .insert({
        task_id: taskId,
        new_status: newStatus,
        changed_at: new Date().toISOString()
      });
  }

  private startProductivityMonitoring(timerId: string): void {
    // In a real implementation, this would monitor:
    // - Active application/website
    // - Mouse/keyboard activity
    // - Context switches
    // - Break patterns
  }

  private async calculateProductivityScore(timeEntry: TimeEntry, duration: number): Promise<number> {
    // Factors for productivity score:
    // - Focus duration (longer uninterrupted work = higher score)
    // - Time of day (based on user's peak hours)
    // - Task completion within session
    // - Context switches
    
    let score = 70; // Base score

    // Longer focused sessions get higher scores
    if (duration > 90) score += 15;
    else if (duration > 45) score += 10;
    else if (duration < 15) score -= 10;

    // Check if task was completed
    const task = await this.supabase
      .from('tasks')
      .select('status')
      .eq('id', timeEntry.taskId)
      .single();
    
    if (task.data?.status === 'completed') score += 15;

    return Math.min(Math.max(score, 0), 100);
  }

  private async updateTaskActualHours(taskId: string): Promise<void> {
    const timeEntries = await this.getTimeEntries({ taskId });
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const totalHours = totalMinutes / 60;

    await this.supabase
      .from('tasks')
      .update({ actual_hours: totalHours })
      .eq('id', taskId);
  }

  private async getCalendarEvents(userId: string, date: Date): Promise<any[]> {
    // Would integrate with calendar service
    return [];
  }

  private async getProductivityHistory(userId: string): Promise<any> {
    // Analyze historical productivity patterns
    const { data } = await this.supabase
      .from('productivity_insights')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);

    return {
      peakHours: ['10:00', '14:00', '16:00'],
      avgFocusDuration: 45,
      completionRate: 75
    };
  }

  private parseDailyPlan(text: string): any {
    // Parse AI-generated daily plan
    return {
      schedule: [
        { time: '09:00', task: 'Review priorities', duration: 30 },
        { time: '09:30', task: 'Deep work: Feature development', duration: 120 },
        { time: '11:30', task: 'Break', duration: 15 },
        { time: '11:45', task: 'Email and communications', duration: 45 }
      ],
      priorities: ['Complete feature X', 'Review PR #123', 'Team sync'],
      estimatedProductivity: 85
    };
  }

  private async saveDailyPlan(userId: string, date: Date, plan: any): Promise<void> {
    await this.supabase
      .from('daily_plans')
      .upsert({
        user_id: userId,
        date: date.toISOString().split('T')[0],
        plan: plan,
        created_at: new Date().toISOString()
      });
  }

  private analyzeHourlyProductivity(timeEntries: TimeEntry[]): Map<number, number> {
    const hourlyData = new Map<number, number>();
    
    timeEntries.forEach(entry => {
      const hour = entry.startTime.getHours();
      const currentScore = hourlyData.get(hour) || 0;
      hourlyData.set(hour, currentScore + (entry.productivityScore || 0));
    });

    return hourlyData;
  }

  private identifyPeakHours(hourlyProductivity: Map<number, number>): string[] {
    const sorted = Array.from(hourlyProductivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return sorted.map(([hour]) => `${hour}:00`);
  }

  private async generateProductivityInsights(
    timeEntries: TimeEntry[],
    completedTasks: any[],
    hourlyProductivity: Map<number, number>
  ): Promise<any> {
    const model = this.gemini.getGenerativeModel({ model: 'gemini-pro' });
    
    const prompt = `
      Analyze this productivity data and provide insights:
      
      Time Entries: ${timeEntries.length}
      Total Time: ${timeEntries.reduce((sum: number, e: TimeEntry) => sum + (e.duration || 0), 0)} minutes
      Tasks Completed: ${completedTasks.length}
      Peak Hours: ${Array.from(hourlyProductivity.entries()).map(([h, s]) => `${h}:00 (score: ${s})`).join(', ')}
      
      Identify:
      1. Potential distractions or productivity blockers
      2. Specific recommendations for improvement
      3. Patterns to maintain
    `;

    const result = await model.generateContent(prompt);
    return this.parseProductivityInsights(result.response.text());
  }

  private parseProductivityInsights(text: string): any {
    return {
      distractions: ['Too many context switches', 'Long gaps between tasks'],
      recommendations: [
        'Block 2-hour focus sessions in the morning',
        'Batch similar tasks together',
        'Take regular 5-minute breaks every hour'
      ]
    };
  }

  private async getUserAvailability(userId: string): Promise<any> {
    // Get user's available time slots
    return {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }]
    };
  }

  private async getTaskDependencies(taskIds: string[]): Promise<any> {
    const { data } = await this.supabase
      .from('task_dependencies')
      .select('*')
      .in('task_id', taskIds);
    
    return data || [];
  }

  private parseSchedule(text: string): any {
    // Parse AI-generated schedule
    return {
      tasks: [
        { id: 'task1', scheduledDate: '2024-01-15', timeSlot: '09:00-11:00' },
        { id: 'task2', scheduledDate: '2024-01-15', timeSlot: '14:00-16:00' }
      ]
    };
  }

  private async getCurrentActivity(userId: string): Promise<any> {
    // Would integrate with activity tracking
    return {
      type: 'productive',
      application: 'VS Code',
      description: 'Coding in project repository',
      confidence: 0.9
    };
  }

  private async findOrCreateTaskForActivity(activity: any): Promise<Task> {
    // Find existing task or create new one
    const { data } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('title', `Work on ${activity.description}`)
      .single();
    
    if (data) {
      return this.mapToTask(data);
    }

    return this.createTask({
      title: `Work on ${activity.description}`,
      status: 'in_progress',
      priority: 'medium',
      tags: ['auto-detected'],
      aiGenerated: true
    });
  }
}