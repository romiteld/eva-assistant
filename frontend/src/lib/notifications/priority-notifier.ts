import { supabase } from '@/lib/supabase/browser';
import { ParsedEmail, DealData } from '@/types/email';

export interface NotificationConfig {
  enabled: boolean;
  channels: ('email' | 'sms' | 'push' | 'in-app')[];
  urgencyThreshold: number;
  quietHours?: {
    start: string; // e.g., "22:00"
    end: string;   // e.g., "08:00"
  };
  escalationRules?: EscalationRule[];
}

export interface EscalationRule {
  priority: number;
  notifyAfter: number; // minutes
  escalateTo: string[]; // user IDs or roles
}

export interface NotificationEvent {
  id: string;
  type: 'high_priority_email' | 'urgent_deal' | 'escalation' | 'sla_breach';
  priority: number;
  title: string;
  message: string;
  data: any;
  userId: string;
  channels: string[];
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  createdAt: Date;
  sentAt?: Date;
  acknowledgedAt?: Date;
}

export class PriorityNotificationSystem {
  private config: NotificationConfig;
  private userId: string;
  private notificationQueue: Map<string, NodeJS.Timeout> = new Map();

  constructor(userId: string, config?: NotificationConfig) {
    this.userId = userId;
    this.config = config || {
      enabled: true,
      channels: ['in-app', 'email'],
      urgencyThreshold: 8,
      quietHours: {
        start: '22:00',
        end: '08:00'
      },
      escalationRules: [
        {
          priority: 10,
          notifyAfter: 15,
          escalateTo: ['manager']
        },
        {
          priority: 9,
          notifyAfter: 30,
          escalateTo: ['team_lead']
        },
        {
          priority: 8,
          notifyAfter: 60,
          escalateTo: ['assigned_recruiter']
        }
      ]
    };
  }

  async notifyHighPriorityEmail(email: ParsedEmail, priority: number): Promise<void> {
    if (!this.config.enabled || priority < this.config.urgencyThreshold) {
      return;
    }

    const notification: Omit<NotificationEvent, 'id' | 'createdAt'> = {
      type: 'high_priority_email',
      priority,
      title: 'High Priority Email Received',
      message: `Urgent email from ${email.from.name || email.from.email}: "${email.subject}"`,
      data: {
        emailId: email.id,
        from: email.from,
        subject: email.subject,
        preview: email.body.substring(0, 200)
      },
      userId: this.userId,
      channels: this.getActiveChannels(),
      status: 'pending'
    };

    await this.sendNotification(notification);

    // Set up escalation if needed
    if (priority >= 9) {
      this.scheduleEscalation(email.id, priority);
    }
  }

  async notifyUrgentDeal(deal: DealData, urgencyScore: number): Promise<void> {
    if (!this.config.enabled || urgencyScore < this.config.urgencyThreshold) {
      return;
    }

    const notification: Omit<NotificationEvent, 'id' | 'createdAt'> = {
      type: 'urgent_deal',
      priority: urgencyScore,
      title: 'Urgent Deal Created',
      message: `High-priority deal "${deal.name}" requires immediate attention`,
      data: {
        dealId: deal.id,
        dealName: deal.name,
        estimatedValue: deal.estimatedValue,
        expectedCloseDate: deal.expectedCloseDate,
        source: deal.source
      },
      userId: this.userId,
      channels: this.getActiveChannels(),
      status: 'pending'
    };

    await this.sendNotification(notification);

    // Set up SLA monitoring
    this.monitorDealSLA(deal, urgencyScore);
  }

  private async sendNotification(notification: Omit<NotificationEvent, 'id' | 'createdAt'>): Promise<void> {
    try {
      // Store notification in database
      const { data: notificationRecord, error } = await supabase
        .from('notifications')
        .insert({
          ...notification,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Send through each channel
      for (const channel of notification.channels) {
        await this.sendToChannel(channel, notificationRecord);
      }

      // Update status
      await supabase
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', notificationRecord.id);

    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  private async sendToChannel(channel: string, notification: NotificationEvent): Promise<void> {
    switch (channel) {
      case 'in-app':
        await this.sendInAppNotification(notification);
        break;
      case 'email':
        await this.sendEmailNotification(notification);
        break;
      case 'sms':
        await this.sendSMSNotification(notification);
        break;
      case 'push':
        await this.sendPushNotification(notification);
        break;
    }
  }

  private async sendInAppNotification(notification: NotificationEvent): Promise<void> {
    // Real-time notification via Supabase
    const channel = supabase.channel(`notifications:${notification.userId}`);
    
    await channel.send({
      type: 'broadcast',
      event: 'new_notification',
      payload: notification
    });
  }

  private async sendEmailNotification(notification: NotificationEvent): Promise<void> {
    // Queue email notification
    const { error } = await supabase
      .from('email_queue')
      .insert({
        to: await this.getUserEmail(notification.userId),
        subject: `[URGENT] ${notification.title}`,
        body: this.formatEmailBody(notification),
        priority: notification.priority,
        metadata: {
          notification_id: notification.id,
          type: 'priority_notification'
        }
      });

    if (error) {
      console.error('Error queueing email notification:', error);
    }
  }

  private async sendSMSNotification(notification: NotificationEvent): Promise<void> {
    // Check if within quiet hours
    if (this.isQuietHours() && notification.priority < 10) {
      console.log('Skipping SMS notification during quiet hours');
      return;
    }

    // Get user's phone number
    const phone = await this.getUserPhone(notification.userId);
    if (!phone) return;

    // Send via Twilio (if configured)
    try {
      const response = await fetch('/api/twilio/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone,
          message: `${notification.title}: ${notification.message}`,
          priority: notification.priority >= 9
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending SMS notification:', error);
    }
  }

  private async sendPushNotification(notification: NotificationEvent): Promise<void> {
    // Web Push API implementation
    try {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', notification.userId);

      if (!subscriptions || subscriptions.length === 0) return;

      for (const subscription of subscriptions) {
        await fetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.subscription_data,
            notification: {
              title: notification.title,
              body: notification.message,
              icon: '/icon-192x192.png',
              badge: '/badge-72x72.png',
              tag: notification.type,
              data: notification.data,
              requireInteraction: notification.priority >= 9
            }
          })
        });
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  private scheduleEscalation(emailId: string, priority: number): void {
    const escalationRule = this.config.escalationRules?.find(
      rule => priority >= rule.priority
    );

    if (!escalationRule) return;

    const timeoutId = setTimeout(async () => {
      // Check if already handled
      const { data: email } = await supabase
        .from('processed_emails')
        .select('status')
        .eq('id', emailId)
        .single();

      if (email?.status === 'processed') {
        return; // Already handled
      }

      // Escalate
      await this.escalateNotification(emailId, escalationRule);
    }, escalationRule.notifyAfter * 60 * 1000);

    this.notificationQueue.set(emailId, timeoutId);
  }

  private async escalateNotification(emailId: string, rule: EscalationRule): Promise<void> {
    const escalationTargets = await this.resolveEscalationTargets(rule.escalateTo);

    for (const targetUserId of escalationTargets) {
      const notification: Omit<NotificationEvent, 'id' | 'createdAt'> = {
        type: 'escalation',
        priority: 10,
        title: 'Escalation: Unhandled High Priority Email',
        message: `An urgent email has not been processed within ${rule.notifyAfter} minutes`,
        data: {
          emailId,
          escalationRule: rule,
          originalPriority: rule.priority
        },
        userId: targetUserId,
        channels: ['in-app', 'email', 'sms'], // All channels for escalations
        status: 'pending'
      };

      await this.sendNotification(notification);
    }
  }

  private monitorDealSLA(deal: DealData, urgencyScore: number): void {
    // Set up SLA monitoring based on urgency
    const slaMinutes = urgencyScore >= 9 ? 30 : urgencyScore >= 7 ? 120 : 240;

    const timeoutId = setTimeout(async () => {
      // Check if deal has been updated
      const { data: currentDeal } = await supabase
        .from('deals')
        .select('last_activity_at')
        .eq('id', deal.id)
        .single();

      const lastActivity = currentDeal?.last_activity_at 
        ? new Date(currentDeal.last_activity_at)
        : new Date(deal.createdAt || Date.now());

      const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60);

      if (minutesSinceActivity >= slaMinutes) {
        await this.notifySLABreach(deal, slaMinutes);
      }
    }, slaMinutes * 60 * 1000);

    this.notificationQueue.set(`deal-sla-${deal.id}`, timeoutId);
  }

  private async notifySLABreach(deal: DealData, slaMinutes: number): Promise<void> {
    const notification: Omit<NotificationEvent, 'id' | 'createdAt'> = {
      type: 'sla_breach',
      priority: 9,
      title: 'SLA Breach Alert',
      message: `Deal "${deal.name}" has not been updated in ${slaMinutes} minutes`,
      data: {
        dealId: deal.id,
        dealName: deal.name,
        slaMinutes,
        estimatedValue: deal.estimatedValue
      },
      userId: this.userId,
      channels: this.getActiveChannels(),
      status: 'pending'
    };

    await this.sendNotification(notification);
  }

  private getActiveChannels(): string[] {
    if (this.isQuietHours()) {
      // During quiet hours, only use in-app notifications unless very urgent
      return ['in-app'];
    }
    return this.config.channels;
  }

  private isQuietHours(): boolean {
    if (!this.config.quietHours) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = this.config.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = this.config.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Normal case (e.g., 22:00 to 08:00)
      return currentTime >= startTime || currentTime < endTime;
    } else {
      // Crosses midnight
      return currentTime >= startTime && currentTime < endTime;
    }
  }

  private async resolveEscalationTargets(targets: string[]): Promise<string[]> {
    const resolvedTargets: string[] = [];

    for (const target of targets) {
      if (target === 'manager' || target === 'team_lead') {
        // Get users with specific roles
        const { data: users } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', target);
        
        if (users) {
          resolvedTargets.push(...users.map(u => u.user_id));
        }
      } else if (target === 'assigned_recruiter') {
        // Get the assigned recruiter for this user
        resolvedTargets.push(this.userId);
      } else {
        // Direct user ID
        resolvedTargets.push(target);
      }
    }

    return [...new Set(resolvedTargets)]; // Remove duplicates
  }

  private async getUserEmail(userId: string): Promise<string> {
    const { data } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();
    
    return data?.email || '';
  }

  private async getUserPhone(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('user_profiles')
      .select('phone')
      .eq('user_id', userId)
      .single();
    
    return data?.phone || null;
  }

  private formatEmailBody(notification: NotificationEvent): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #ff4444; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f4f4f4; }
    .priority { display: inline-block; background-color: #ff6666; color: white; padding: 5px 10px; border-radius: 3px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
    .details { background-color: white; padding: 15px; margin-top: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${notification.title}</h1>
      <span class="priority">Priority: ${notification.priority}/10</span>
    </div>
    <div class="content">
      <p><strong>${notification.message}</strong></p>
      
      <div class="details">
        ${this.formatNotificationDetails(notification)}
      </div>
      
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/notifications/${notification.id}" class="button">
        View in Dashboard
      </a>
    </div>
  </div>
</body>
</html>
    `;
  }

  private formatNotificationDetails(notification: NotificationEvent): string {
    switch (notification.type) {
      case 'high_priority_email':
        return `
          <h3>Email Details:</h3>
          <ul>
            <li><strong>From:</strong> ${notification.data.from.name} (${notification.data.from.email})</li>
            <li><strong>Subject:</strong> ${notification.data.subject}</li>
            <li><strong>Preview:</strong> ${notification.data.preview}...</li>
          </ul>
        `;
      
      case 'urgent_deal':
        return `
          <h3>Deal Details:</h3>
          <ul>
            <li><strong>Deal Name:</strong> ${notification.data.dealName}</li>
            <li><strong>Value:</strong> $${notification.data.estimatedValue?.toLocaleString() || 'TBD'}</li>
            <li><strong>Expected Close:</strong> ${notification.data.expectedCloseDate || 'TBD'}</li>
            <li><strong>Source:</strong> ${notification.data.source}</li>
          </ul>
        `;
      
      case 'escalation':
        return `
          <h3>Escalation Details:</h3>
          <ul>
            <li><strong>Original Priority:</strong> ${notification.data.originalPriority}/10</li>
            <li><strong>Time Elapsed:</strong> ${notification.data.escalationRule.notifyAfter} minutes</li>
            <li><strong>Action Required:</strong> Immediate attention needed</li>
          </ul>
        `;
      
      case 'sla_breach':
        return `
          <h3>SLA Breach Details:</h3>
          <ul>
            <li><strong>Deal:</strong> ${notification.data.dealName}</li>
            <li><strong>SLA Time:</strong> ${notification.data.slaMinutes} minutes</li>
            <li><strong>Value at Risk:</strong> $${notification.data.estimatedValue?.toLocaleString() || 'TBD'}</li>
          </ul>
        `;
      
      default:
        return '';
    }
  }

  // Cleanup method
  destroy(): void {
    // Clear all scheduled timeouts
    for (const [key, timeoutId] of this.notificationQueue) {
      clearTimeout(timeoutId);
    }
    this.notificationQueue.clear();
  }

  // Configuration methods
  async updateConfig(updates: Partial<NotificationConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    
    // Save to user preferences
    await supabase
      .from('user_preferences')
      .upsert({
        user_id: this.userId,
        notification_config: this.config
      });
  }

  async acknowledgeNotification(notificationId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', notificationId);
    
    // Cancel any related escalations
    const key = `escalation-${notificationId}`;
    if (this.notificationQueue.has(key)) {
      clearTimeout(this.notificationQueue.get(key)!);
      this.notificationQueue.delete(key);
    }
  }

  async getNotificationHistory(limit: number = 50): Promise<NotificationEvent[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching notification history:', error);
      return [];
    }
    
    return data || [];
  }

  async getUnacknowledgedCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', this.userId)
      .eq('status', 'sent');
    
    if (error) {
      console.error('Error counting unacknowledged notifications:', error);
      return 0;
    }
    
    return count || 0;
  }
}