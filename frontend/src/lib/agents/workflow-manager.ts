// Enhanced Workflow Manager with Database Integration
import { supabase } from '@/lib/supabase/browser';
import { WorkflowEngine, Workflow, WorkflowUpdate } from './a2a-orchestrator';

export interface DatabaseWorkflow {
  id: string;
  user_id: string;
  name: string;
  agent: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress: number;
  metadata: Record<string, any>;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export class WorkflowManager {
  /**
   * Create a new workflow in the database
   */
  static async createWorkflow(
    userId: string,
    name: string,
    agent: string,
    metadata: Record<string, any> = {}
  ): Promise<DatabaseWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          user_id: userId,
          name,
          agent,
          status: 'pending',
          progress: 0,
          metadata
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create workflow:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating workflow:', error);
      return null;
    }
  }

  /**
   * Update workflow status in the database
   */
  static async updateWorkflowStatus(
    workflowId: string,
    status: DatabaseWorkflow['status'],
    progress?: number,
    errorMessage?: string
  ): Promise<boolean> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (progress !== undefined) {
        updateData.progress = progress;
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('workflows')
        .update(updateData)
        .eq('id', workflowId);

      if (error) {
        console.error('Failed to update workflow status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating workflow status:', error);
      return false;
    }
  }

  /**
   * Execute a workflow with database tracking
   */
  static async *executeWithTracking(
    workflow: Workflow,
    userId: string,
    metadata: Record<string, any> = {}
  ): AsyncGenerator<WorkflowUpdate & { dbWorkflow?: DatabaseWorkflow }> {
    // Create workflow in database
    const dbWorkflow = await this.createWorkflow(
      userId,
      workflow.name,
      workflow.agents.join(', '),
      {
        ...metadata,
        workflowDefinition: workflow
      }
    );

    if (!dbWorkflow) {
      yield {
        type: 'workflow_failed',
        error: 'Failed to create workflow in database'
      };
      return;
    }

    // Update status to active
    await this.updateWorkflowStatus(dbWorkflow.id, 'active', 0);

    try {
      // Execute workflow
      for await (const update of WorkflowEngine.execute(workflow)) {
        // Update progress in database
        if (update.progress !== undefined) {
          await this.updateWorkflowStatus(
            dbWorkflow.id,
            'active',
            Math.round(update.progress)
          );
        }

        // Handle failures
        if (update.type === 'task_failed') {
          await this.updateWorkflowStatus(
            dbWorkflow.id,
            'failed',
            undefined,
            update.error
          );
        }

        // Handle completion
        if (update.type === 'workflow_complete') {
          await this.updateWorkflowStatus(
            dbWorkflow.id,
            'completed',
            100
          );
        }

        // Yield update with database workflow info
        yield { ...update, dbWorkflow };
      }
    } catch (error) {
      // Update status to failed
      await this.updateWorkflowStatus(
        dbWorkflow.id,
        'failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );

      yield {
        type: 'workflow_failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        dbWorkflow
      };
    }
  }

  /**
   * Get workflows by status
   */
  static async getWorkflowsByStatus(
    userId: string,
    status?: DatabaseWorkflow['status']
  ): Promise<DatabaseWorkflow[]> {
    try {
      let query = supabase
        .from('workflows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to get workflows:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting workflows:', error);
      return [];
    }
  }

  /**
   * Get workflow by ID
   */
  static async getWorkflow(workflowId: string): Promise<DatabaseWorkflow | null> {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (error) {
        console.error('Failed to get workflow:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting workflow:', error);
      return null;
    }
  }

  /**
   * Cancel a workflow
   */
  static async cancelWorkflow(workflowId: string): Promise<boolean> {
    return await this.updateWorkflowStatus(
      workflowId,
      'failed',
      undefined,
      'Workflow cancelled by user'
    );
  }

  /**
   * Get workflow statistics
   */
  static async getWorkflowStats(userId: string): Promise<{
    total: number;
    pending: number;
    active: number;
    completed: number;
    failed: number;
    successRate: number;
  }> {
    try {
      const workflows = await this.getWorkflowsByStatus(userId);
      
      const stats = {
        total: workflows.length,
        pending: workflows.filter(w => w.status === 'pending').length,
        active: workflows.filter(w => w.status === 'active').length,
        completed: workflows.filter(w => w.status === 'completed').length,
        failed: workflows.filter(w => w.status === 'failed').length,
        successRate: 0
      };

      if (stats.completed + stats.failed > 0) {
        stats.successRate = (stats.completed / (stats.completed + stats.failed)) * 100;
      }

      return stats;
    } catch (error) {
      console.error('Error getting workflow stats:', error);
      return {
        total: 0,
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        successRate: 0
      };
    }
  }

  /**
   * Clean up old workflows
   */
  static async cleanupOldWorkflows(userId: string, daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase
        .from('workflows')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', cutoffDate.toISOString())
        .in('status', ['completed', 'failed'])
        .select();

      if (error) {
        console.error('Failed to cleanup workflows:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Error cleaning up workflows:', error);
      return 0;
    }
  }
}