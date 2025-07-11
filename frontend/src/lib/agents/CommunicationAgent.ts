import { z } from 'zod';
import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage } from './base/types';
import { Twilio } from 'twilio';
import axios from 'axios';

// Input/Output schemas
const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string(),
  body: z.string(),
  html: z.string().optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string(),
  })).optional(),
});

const SendSmsSchema = z.object({
  to: z.string(),
  body: z.string(),
  mediaUrl: z.string().url().optional(),
});

const MakeCallSchema = z.object({
  to: z.string(),
  message: z.string(),
  voice: z.enum(['man', 'woman', 'alice', 'polly']).optional(),
  language: z.string().optional(),
});

const ScheduleCallSchema = z.object({
  to: z.string(),
  scheduledTime: z.string().datetime(),
  message: z.string(),
  voice: z.enum(['man', 'woman', 'alice', 'polly']).optional(),
});

const GetEmailHistorySchema = z.object({
  email: z.string().email().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().optional(),
});

const GetSmsHistorySchema = z.object({
  phoneNumber: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.number().optional(),
});

export class CommunicationAgent extends Agent {
  private twilioClient?: Twilio;
  private emailApiUrl?: string;

  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'Communication Agent',
      type: AgentType.COMMUNICATION,
      description: 'Handles email, SMS, and voice call communications',
      ...config,
    });

    this.registerActions();
  }

  protected async onInitialize(): Promise<void> {
    // Initialize Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (accountSid && authToken) {
      this.twilioClient = new Twilio(accountSid, authToken);
    } else {
      console.warn('Twilio credentials not found. SMS and call functionality will be limited.');
    }

    // Set email API URL
    this.emailApiUrl = process.env.EMAIL_API_URL || '/api/email';
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any resources
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
      case 'send_email':
        return this.sendEmail(payload);
      case 'send_sms':
        return this.sendSms(payload);
      case 'make_call':
        return this.makeCall(payload);
      case 'schedule_call':
        return this.scheduleCall(payload);
      case 'get_email_history':
        return this.getEmailHistory(payload);
      case 'get_sms_history':
        return this.getSmsHistory(payload);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private registerActions(): void {
    this.registerAction('send_email', {
      name: 'send_email',
      description: 'Send an email',
      inputSchema: SendEmailSchema,
      outputSchema: z.object({
        messageId: z.string(),
        accepted: z.array(z.string()),
        rejected: z.array(z.string()),
        timestamp: z.string(),
      }),
    });

    this.registerAction('send_sms', {
      name: 'send_sms',
      description: 'Send an SMS message',
      inputSchema: SendSmsSchema,
      outputSchema: z.object({
        sid: z.string(),
        status: z.string(),
        dateCreated: z.string(),
        to: z.string(),
        from: z.string(),
      }),
    });

    this.registerAction('make_call', {
      name: 'make_call',
      description: 'Make a voice call',
      inputSchema: MakeCallSchema,
      outputSchema: z.object({
        sid: z.string(),
        status: z.string(),
        dateCreated: z.string(),
        to: z.string(),
        from: z.string(),
      }),
    });

    this.registerAction('schedule_call', {
      name: 'schedule_call',
      description: 'Schedule a voice call',
      inputSchema: ScheduleCallSchema,
      outputSchema: z.object({
        scheduledId: z.string(),
        scheduledTime: z.string(),
        status: z.string(),
      }),
    });

    this.registerAction('get_email_history', {
      name: 'get_email_history',
      description: 'Get email history',
      inputSchema: GetEmailHistorySchema,
      outputSchema: z.array(z.object({
        id: z.string(),
        from: z.string(),
        to: z.array(z.string()),
        subject: z.string(),
        timestamp: z.string(),
        status: z.string(),
      })),
    });

    this.registerAction('get_sms_history', {
      name: 'get_sms_history',
      description: 'Get SMS history',
      inputSchema: GetSmsHistorySchema,
      outputSchema: z.array(z.object({
        sid: z.string(),
        from: z.string(),
        to: z.string(),
        body: z.string(),
        status: z.string(),
        dateCreated: z.string(),
      })),
    });
  }

  private async sendEmail(input: z.infer<typeof SendEmailSchema>) {
    try {
      // Use Microsoft Graph API or SMTP service
      const response = await axios.post(this.emailApiUrl!, {
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        body: input.body,
        html: input.html,
        cc: input.cc,
        bcc: input.bcc,
        attachments: input.attachments,
      });

      const result = response.data;

      this.broadcast('email_sent', {
        to: input.to,
        subject: input.subject,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      this.broadcast('email_failed', {
        to: input.to,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async sendSms(input: z.infer<typeof SendSmsSchema>) {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: input.body,
        to: input.to,
        from: process.env.TWILIO_PHONE_NUMBER!,
        mediaUrl: input.mediaUrl ? [input.mediaUrl] : undefined,
      });

      this.broadcast('sms_sent', {
        to: input.to,
        sid: message.sid,
      });

      return {
        sid: message.sid,
        status: message.status,
        dateCreated: message.dateCreated.toISOString(),
        to: message.to,
        from: message.from,
      };
    } catch (error) {
      this.broadcast('sms_failed', {
        to: input.to,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async makeCall(input: z.infer<typeof MakeCallSchema>) {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      // Generate TwiML for the call
      const twiml = `
        <Response>
          <Say voice="${input.voice || 'woman'}" language="${input.language || 'en-US'}">
            ${input.message}
          </Say>
        </Response>
      `;

      // Create a TwiML bin or use a webhook URL
      const call = await this.twilioClient.calls.create({
        twiml,
        to: input.to,
        from: process.env.TWILIO_PHONE_NUMBER!,
      });

      this.broadcast('call_initiated', {
        to: input.to,
        sid: call.sid,
      });

      return {
        sid: call.sid,
        status: call.status,
        dateCreated: call.dateCreated.toISOString(),
        to: call.to,
        from: call.from,
      };
    } catch (error) {
      this.broadcast('call_failed', {
        to: input.to,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async scheduleCall(input: z.infer<typeof ScheduleCallSchema>) {
    // This would typically integrate with a scheduling service
    // For now, we'll simulate scheduling
    const scheduledId = `scheduled_${Date.now()}`;
    
    // In a real implementation, this would create a scheduled job
    setTimeout(async () => {
      try {
        await this.makeCall({
          to: input.to,
          message: input.message,
          voice: input.voice,
        });
        
        this.broadcast('scheduled_call_executed', {
          scheduledId,
          to: input.to,
        });
      } catch (error) {
        this.broadcast('scheduled_call_failed', {
          scheduledId,
          to: input.to,
          error: (error as Error).message,
        });
      }
    }, new Date(input.scheduledTime).getTime() - Date.now());

    this.broadcast('call_scheduled', {
      scheduledId,
      to: input.to,
      scheduledTime: input.scheduledTime,
    });

    return {
      scheduledId,
      scheduledTime: input.scheduledTime,
      status: 'scheduled',
    };
  }

  private async getEmailHistory(input: z.infer<typeof GetEmailHistorySchema>) {
    try {
      // Query email service for history
      const response = await axios.get(`${this.emailApiUrl}/history`, {
        params: {
          email: input.email,
          startDate: input.startDate,
          endDate: input.endDate,
          limit: input.limit || 50,
        },
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to get email history: ${(error as Error).message}`);
    }
  }

  private async getSmsHistory(input: z.infer<typeof GetSmsHistorySchema>) {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const messages = await this.twilioClient.messages.list({
        to: input.phoneNumber,
        dateSentAfter: input.startDate ? new Date(input.startDate) : undefined,
        dateSentBefore: input.endDate ? new Date(input.endDate) : undefined,
        limit: input.limit || 50,
      });

      return messages.map(msg => ({
        sid: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: msg.status,
        dateCreated: msg.dateCreated.toISOString(),
      }));
    } catch (error) {
      throw new Error(`Failed to get SMS history: ${(error as Error).message}`);
    }
  }
}