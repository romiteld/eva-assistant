import { NextRequest, NextResponse } from 'next/server';
import { WorkflowAgent } from '@/lib/agents/WorkflowAgent';
import { WorkflowTemplates } from '@/lib/workflows/WorkflowTemplates';
import { StateManager } from '@/lib/workflows/StateManager';
import { AuthenticatedRequest } from '@/middleware/auth';
import { withAuthAndRateLimit, API_SECURITY_TYPES } from '@/middleware/api-security';

const stateManager = new StateManager();

// GET /api/agents/workflows - List workflows and templates
export const GET = withAuthAndRateLimit(handleGetWorkflows, API_SECURITY_TYPES.API);

async function handleGetWorkflows(request: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    if (type === 'templates') {
      const templates = WorkflowTemplates.getAllTemplates();
      return NextResponse.json({ templates });
    }
    
    // Get active and historical workflows
    const workflows = await stateManager.listWorkflows();
    
    return NextResponse.json({
      workflows,
      templates: WorkflowTemplates.getAllTemplates().map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
      })),
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

// POST /api/agents/workflows - Create and execute a workflow
export const POST = withAuthAndRateLimit(handlePostWorkflows, API_SECURITY_TYPES.AI);

async function handlePostWorkflows(request: AuthenticatedRequest) {
  try {
    const body = await request.json();
    const { templateId, workflow, context } = body;
    
    let workflowConfig;
    
    if (templateId) {
      // Create from template
      workflowConfig = WorkflowTemplates.createWorkflowFromTemplate(templateId, context);
    } else if (workflow) {
      // Use provided workflow
      workflowConfig = workflow;
    } else {
      return NextResponse.json(
        { error: 'Either templateId or workflow must be provided' },
        { status: 400 }
      );
    }
    
    // Get or create workflow agent
    const workflowAgent = new WorkflowAgent();
    await workflowAgent.initialize();
    
    // Execute workflow
    const result = await workflowAgent.sendRequest(
      workflowAgent.getId(),
      'orchestrate',
      workflowConfig
    );
    
    return NextResponse.json({
      success: true,
      workflowId: result.workflowId,
      status: result.status,
      result: result.result,
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    );
  }
}

// DELETE /api/agents/workflows/:id - Cancel a workflow
export const DELETE = withAuthAndRateLimit(handleDeleteWorkflows, API_SECURITY_TYPES.AI);

async function handleDeleteWorkflows(request: AuthenticatedRequest) {
  try {
    const { pathname } = new URL(request.url);
    const workflowId = pathname.split('/').pop();
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }
    
    // Get workflow agent
    const workflowAgent = new WorkflowAgent();
    await workflowAgent.initialize();
    
    // Cancel workflow
    await workflowAgent.sendRequest(
      workflowAgent.getId(),
      'rollback',
      { workflowId }
    );
    
    return NextResponse.json({
      success: true,
      message: 'Workflow cancelled',
    });
  } catch (error) {
    console.error('Error cancelling workflow:', error);
    return NextResponse.json(
      { error: 'Failed to cancel workflow' },
      { status: 500 }
    );
  }
}