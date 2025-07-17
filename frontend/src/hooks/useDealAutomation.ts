import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DealAutomationAgent } from '@/lib/agents/deal-automation-agent';
import { toast } from 'react-hot-toast';

interface DealCreationResult {
  deal: {
    id: string;
    Deal_Name: string;
    Stage: string;
    Amount?: number;
    Closing_Date: string;
    createdAt: string;
  };
  metrics: {
    duration: number;
    source: string;
    steps: Array<{
      name: string;
      duration: number;
      success: boolean;
      error?: string;
    }>;
  };
}

interface PerformanceMetrics {
  averageDuration: number;
  successRate: number;
  totalDeals: number;
  bySource: Record<string, { count: number; avgDuration: number }>;
}

export const useDealAutomation = () => {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [agent, setAgent] = useState<DealAutomationAgent | null>(null);

  // Initialize agent
  const initializeAgent = useCallback(async () => {
    if (!agent && user) {
      const dealAgent = new DealAutomationAgent({
        name: 'Deal Automation Agent',
        metadata: { userId: user.id }
      });
      await dealAgent.initialize();
      setAgent(dealAgent);
      
      // Load initial metrics
      const performanceMetrics = dealAgent.getPerformanceMetrics();
      setMetrics(performanceMetrics);
      
      // Listen for deal creation events
      dealAgent.on('deal-created', () => {
        const updatedMetrics = dealAgent.getPerformanceMetrics();
        setMetrics(updatedMetrics);
      });
    }
  }, [user, agent]);

  // Create deal from email
  const createFromEmail = useCallback(async (email: {
    id: string;
    from: string;
    to: string[];
    subject: string;
    content: string;
    attachments?: Array<{ name: string; type: string; url: string }>;
    timestamp: Date;
    threadId?: string;
  }): Promise<DealCreationResult> => {
    if (!user) throw new Error('User not authenticated');
    
    setIsCreating(true);
    try {
      await initializeAgent();
      
      const result = await agent!.sendRequest(
        agent!.getId(),
        'createDealFromEmail',
        { email, userId: user.id }
      );
      
      // Show performance toast
      if (result.metrics.duration < 30000) {
        toast.success(`⚡ Deal created in ${(result.metrics.duration / 1000).toFixed(1)}s!`);
      } else {
        toast(`Deal created in ${(result.metrics.duration / 1000).toFixed(1)}s (target: <30s)`)
      }
      
      return result;
    } catch (error) {
      console.error('Failed to create deal from email:', error);
      toast.error('Failed to create deal from email');
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [user, agent, initializeAgent]);

  // Create deal from template
  const createFromTemplate = useCallback(async (
    templateId: string,
    customFields?: Record<string, any>
  ): Promise<DealCreationResult> => {
    if (!user) throw new Error('User not authenticated');
    
    setIsCreating(true);
    try {
      await initializeAgent();
      
      const result = await agent!.sendRequest(
        agent!.getId(),
        'createDealFromTemplate',
        { templateId, customFields, userId: user.id }
      );
      
      return result;
    } catch (error) {
      console.error('Failed to create deal from template:', error);
      toast.error('Failed to create deal from template');
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [user, agent, initializeAgent]);

  // Quick create deal
  const quickCreate = useCallback(async (params: {
    dealName: string;
    contactEmail?: string;
    amount?: number;
    stage?: string;
    dealType?: string;
  }): Promise<DealCreationResult> => {
    if (!user) throw new Error('User not authenticated');
    
    setIsCreating(true);
    try {
      await initializeAgent();
      
      const result = await agent!.sendRequest(
        agent!.getId(),
        'quickCreateDeal',
        { ...params, userId: user.id }
      );
      
      // Show performance toast
      if (result.metrics.duration < 10000) {
        toast.success(`🚀 Lightning fast! Deal created in ${(result.metrics.duration / 1000).toFixed(1)}s!`);
      } else {
        toast.success(`✅ Deal created in ${(result.metrics.duration / 1000).toFixed(1)}s`);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to quick create deal:', error);
      toast.error('Failed to create deal');
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [user, agent, initializeAgent]);

  // Parse email for deal info (preview)
  const previewEmailDeal = useCallback(async (email: {
    from: string;
    subject: string;
    content: string;
  }): Promise<{
    suggestedName: string;
    stage: string;
    urgency: string;
    estimatedAmount?: number;
    dealType?: string;
  }> => {
    // Simple client-side parsing for preview
    const urgencyPatterns = /urgent|asap|immediately|priority|rush/i;
    const budgetPattern = /\$[\d,]+|budget|salary|rate|compensation/i;
    
    const urgency = urgencyPatterns.test(email.content) ? 'high' : 'medium';
    const budgetMatch = email.content.match(/\$?([\d,]+)/);
    
    return {
      suggestedName: email.subject || `Deal - ${email.from}`,
      stage: urgency === 'high' ? 'Value Proposition' : 'Qualification',
      urgency,
      estimatedAmount: budgetMatch ? parseInt(budgetMatch[1].replace(/,/g, '')) : undefined,
      dealType: email.content.toLowerCase().includes('contract') ? 'Contract' : 'Placement'
    };
  }, []);

  return {
    createFromEmail,
    createFromTemplate,
    quickCreate,
    previewEmailDeal,
    isCreating,
    metrics,
    agent
  };
};