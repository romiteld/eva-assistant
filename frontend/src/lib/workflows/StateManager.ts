import { WorkflowState } from '../agents/base/types';
import { LRUCache } from 'lru-cache';

export class StateManager {
  private workflows: Map<string, WorkflowState> = new Map();
  private stateSnapshots: Map<string, WorkflowState[]> = new Map();
  private cache: LRUCache<string, WorkflowState>;

  constructor() {
    this.cache = new LRUCache<string, WorkflowState>({
      max: 100,
      ttl: 1000 * 60 * 60, // 1 hour
    });
  }

  async saveWorkflow(workflow: WorkflowState): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    this.cache.set(workflow.id, workflow);
    
    // Save snapshot for rollback
    this.saveSnapshot(workflow);
  }

  async getWorkflow(workflowId: string): Promise<WorkflowState | undefined> {
    // Check cache first
    const cached = this.cache.get(workflowId);
    if (cached) {
      return cached;
    }

    // Get from storage
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      this.cache.set(workflowId, workflow);
    }
    
    return workflow;
  }

  async updateWorkflow(workflow: WorkflowState): Promise<void> {
    this.workflows.set(workflow.id, workflow);
    this.cache.set(workflow.id, workflow);
    
    // Save snapshot for rollback
    this.saveSnapshot(workflow);
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    this.workflows.delete(workflowId);
    this.cache.delete(workflowId);
    this.stateSnapshots.delete(workflowId);
  }

  async listWorkflows(filter?: {
    status?: WorkflowState['status'];
    startDate?: Date;
    endDate?: Date;
  }): Promise<WorkflowState[]> {
    let workflows = Array.from(this.workflows.values());

    if (filter) {
      if (filter.status) {
        workflows = workflows.filter(w => w.status === filter.status);
      }
      if (filter.startDate) {
        workflows = workflows.filter(w => w.startTime >= filter.startDate!.getTime());
      }
      if (filter.endDate) {
        workflows = workflows.filter(w => w.startTime <= filter.endDate!.getTime());
      }
    }

    return workflows;
  }

  async getWorkflowHistory(workflowId: string): Promise<WorkflowState[]> {
    return this.stateSnapshots.get(workflowId) || [];
  }

  async getWorkflowSnapshot(
    workflowId: string,
    timestamp: number
  ): Promise<WorkflowState | undefined> {
    const snapshots = this.stateSnapshots.get(workflowId) || [];
    
    // Find the snapshot closest to but not after the timestamp
    let closestSnapshot: WorkflowState | undefined;
    for (const snapshot of snapshots) {
      if (snapshot.startTime <= timestamp) {
        closestSnapshot = snapshot;
      } else {
        break;
      }
    }
    
    return closestSnapshot;
  }

  async clearOldWorkflows(olderThan: Date): Promise<number> {
    const cutoffTime = olderThan.getTime();
    let deletedCount = 0;

    for (const [id, workflow] of this.workflows) {
      if (workflow.endTime && workflow.endTime < cutoffTime) {
        await this.deleteWorkflow(id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  private saveSnapshot(workflow: WorkflowState): void {
    const snapshots = this.stateSnapshots.get(workflow.id) || [];
    
    // Deep clone the workflow state
    const snapshot = JSON.parse(JSON.stringify(workflow));
    snapshots.push(snapshot);
    
    // Keep only last 50 snapshots
    if (snapshots.length > 50) {
      snapshots.shift();
    }
    
    this.stateSnapshots.set(workflow.id, snapshots);
  }

  // Persistence methods (for production, use a database)
  async persist(): Promise<void> {
    // In production, save to database
    const data = {
      workflows: Array.from(this.workflows.entries()),
      snapshots: Array.from(this.stateSnapshots.entries()),
    };
    
    // For now, save to localStorage in browser or file system in Node
    if (typeof window !== 'undefined') {
      localStorage.setItem('workflow_state', JSON.stringify(data));
    }
  }

  async restore(): Promise<void> {
    // In production, load from database
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('workflow_state');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          this.workflows = new Map(data.workflows);
          this.stateSnapshots = new Map(data.snapshots);
        } catch (error) {
          console.error('Failed to restore workflow state:', error);
        }
      }
    }
  }
}