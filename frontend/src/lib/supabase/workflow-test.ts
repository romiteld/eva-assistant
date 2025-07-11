import { supabase } from './client';

interface WorkflowTestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

export const workflowTest = {
  // Test 1: Examine workflows table structure and schema
  testWorkflowSchema: async (): Promise<WorkflowTestResult> => {
    try {
      // Test inserting a workflow
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return {
          testName: 'Workflow Schema Test',
          passed: false,
          error: 'No authenticated user'
        };
      }

      // Check if we can query the workflows table
      const { data: existingWorkflows, error: queryError } = await supabase
        .from('workflows')
        .select('*')
        .limit(1);

      if (queryError) {
        return {
          testName: 'Workflow Schema Test',
          passed: false,
          error: `Failed to query workflows table: ${queryError.message}`,
          details: queryError
        };
      }

      return {
        testName: 'Workflow Schema Test',
        passed: true,
        details: {
          canQueryTable: true,
          existingRows: existingWorkflows?.length || 0,
          sampleRow: existingWorkflows?.[0] || null
        }
      };
    } catch (error: any) {
      return {
        testName: 'Workflow Schema Test',
        passed: false,
        error: error.message
      };
    }
  },

  // Test 2: Test workflow creation and management
  testWorkflowCreation: async (): Promise<WorkflowTestResult> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return {
          testName: 'Workflow Creation Test',
          passed: false,
          error: 'No authenticated user'
        };
      }

      // Create a test workflow
      const testWorkflow = {
        user_id: user.user.id,
        name: 'Test Workflow - ' + new Date().toISOString(),
        agent: 'test-agent',
        status: 'pending' as const,
        progress: 0,
        metadata: {
          test: true,
          createdAt: new Date().toISOString()
        }
      };

      const { data: createdWorkflow, error: createError } = await supabase
        .from('workflows')
        .insert(testWorkflow)
        .select()
        .single();

      if (createError) {
        return {
          testName: 'Workflow Creation Test',
          passed: false,
          error: `Failed to create workflow: ${createError.message}`,
          details: createError
        };
      }

      // Clean up
      if (createdWorkflow?.id) {
        await supabase
          .from('workflows')
          .delete()
          .eq('id', createdWorkflow.id);
      }

      return {
        testName: 'Workflow Creation Test',
        passed: true,
        details: {
          created: createdWorkflow
        }
      };
    } catch (error: any) {
      return {
        testName: 'Workflow Creation Test',
        passed: false,
        error: error.message
      };
    }
  },

  // Test 3: Test status progression
  testStatusProgression: async (): Promise<WorkflowTestResult> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return {
          testName: 'Status Progression Test',
          passed: false,
          error: 'No authenticated user'
        };
      }

      // Create a test workflow
      const { data: workflow, error: createError } = await supabase
        .from('workflows')
        .insert({
          user_id: user.user.id,
          name: 'Status Test Workflow',
          agent: 'test-agent',
          status: 'pending',
          progress: 0
        })
        .select()
        .single();

      if (createError || !workflow) {
        return {
          testName: 'Status Progression Test',
          passed: false,
          error: `Failed to create workflow: ${createError?.message}`
        };
      }

      const statusProgression = [];
      
      // Test status transitions: pending -> active -> completed
      const statuses = ['active', 'completed'] as const;
      
      for (const status of statuses) {
        const { data: updated, error: updateError } = await supabase
          .from('workflows')
          .update({ 
            status, 
            progress: status === 'active' ? 50 : 100,
            completed_at: status === 'completed' ? new Date().toISOString() : null
          })
          .eq('id', workflow.id)
          .select()
          .single();

        if (updateError) {
          statusProgression.push({
            status,
            success: false,
            error: updateError.message
          });
        } else {
          statusProgression.push({
            status,
            success: true,
            data: updated
          });
        }
      }

      // Test failed status
      const { data: failedUpdate, error: failedError } = await supabase
        .from('workflows')
        .update({ 
          status: 'failed',
          error_message: 'Test error message'
        })
        .eq('id', workflow.id)
        .select()
        .single();

      statusProgression.push({
        status: 'failed',
        success: !failedError,
        data: failedUpdate,
        error: failedError?.message
      });

      // Clean up
      await supabase
        .from('workflows')
        .delete()
        .eq('id', workflow.id);

      const allSuccess = statusProgression.every(s => s.success);

      return {
        testName: 'Status Progression Test',
        passed: allSuccess,
        details: {
          progression: statusProgression
        }
      };
    } catch (error: any) {
      return {
        testName: 'Status Progression Test',
        passed: false,
        error: error.message
      };
    }
  },

  // Test 4: Test agent assignment
  testAgentAssignment: async (): Promise<WorkflowTestResult> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return {
          testName: 'Agent Assignment Test',
          passed: false,
          error: 'No authenticated user'
        };
      }

      const testAgents = ['firecrawl-agent', 'gemini-agent', 'rag-agent', 'custom-agent'];
      const results = [];

      for (const agent of testAgents) {
        const { data: workflow, error } = await supabase
          .from('workflows')
          .insert({
            user_id: user.user.id,
            name: `Test ${agent}`,
            agent: agent,
            status: 'pending',
            progress: 0
          })
          .select()
          .single();

        results.push({
          agent,
          success: !error,
          error: error?.message,
          data: workflow
        });

        // Clean up
        if (workflow?.id) {
          await supabase
            .from('workflows')
            .delete()
            .eq('id', workflow.id);
        }
      }

      const allSuccess = results.every(r => r.success);

      return {
        testName: 'Agent Assignment Test',
        passed: allSuccess,
        details: {
          agents: results
        }
      };
    } catch (error: any) {
      return {
        testName: 'Agent Assignment Test',
        passed: false,
        error: error.message
      };
    }
  },

  // Test 5: Test progress tracking
  testProgressTracking: async (): Promise<WorkflowTestResult> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return {
          testName: 'Progress Tracking Test',
          passed: false,
          error: 'No authenticated user'
        };
      }

      // Create a test workflow
      const { data: workflow, error: createError } = await supabase
        .from('workflows')
        .insert({
          user_id: user.user.id,
          name: 'Progress Test Workflow',
          agent: 'test-agent',
          status: 'active',
          progress: 0
        })
        .select()
        .single();

      if (createError || !workflow) {
        return {
          testName: 'Progress Tracking Test',
          passed: false,
          error: `Failed to create workflow: ${createError?.message}`
        };
      }

      const progressUpdates = [];
      
      // Test progress updates
      for (let progress = 0; progress <= 100; progress += 25) {
        const { data: updated, error: updateError } = await supabase
          .from('workflows')
          .update({ 
            progress,
            metadata: {
              ...workflow.metadata,
              lastProgress: progress,
              updatedAt: new Date().toISOString()
            }
          })
          .eq('id', workflow.id)
          .select()
          .single();

        progressUpdates.push({
          progress,
          success: !updateError,
          error: updateError?.message,
          data: updated
        });
      }

      // Test invalid progress values
      const invalidTests = [
        { value: -10, shouldFail: true },
        { value: 150, shouldFail: true },
        { value: null, shouldFail: false }
      ];

      for (const test of invalidTests) {
        const { error } = await supabase
          .from('workflows')
          .update({ progress: test.value as any })
          .eq('id', workflow.id);

        progressUpdates.push({
          progress: test.value,
          success: test.shouldFail ? !!error : !error,
          expectedToFail: test.shouldFail,
          error: error?.message
        });
      }

      // Clean up
      await supabase
        .from('workflows')
        .delete()
        .eq('id', workflow.id);

      const allCorrect = progressUpdates.every(p => p.success);

      return {
        testName: 'Progress Tracking Test',
        passed: allCorrect,
        details: {
          updates: progressUpdates
        }
      };
    } catch (error: any) {
      return {
        testName: 'Progress Tracking Test',
        passed: false,
        error: error.message
      };
    }
  },

  // Test 6: Test workflow state management
  testWorkflowStateManagement: async (): Promise<WorkflowTestResult> => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        return {
          testName: 'Workflow State Management Test',
          passed: false,
          error: 'No authenticated user'
        };
      }

      // Create multiple workflows
      const workflows = [];
      for (let i = 0; i < 3; i++) {
        const { data, error } = await supabase
          .from('workflows')
          .insert({
            user_id: user.user.id,
            name: `State Test ${i}`,
            agent: 'test-agent',
            status: i === 0 ? 'pending' : i === 1 ? 'active' : 'completed',
            progress: i * 50
          })
          .select()
          .single();

        if (!error && data) {
          workflows.push(data);
        }
      }

      // Test querying by status
      const statusQueries = [];
      
      for (const status of ['pending', 'active', 'completed', 'failed']) {
        const { data, error } = await supabase
          .from('workflows')
          .select('*')
          .eq('user_id', user.user.id)
          .eq('status', status);

        statusQueries.push({
          status,
          count: data?.length || 0,
          error: error?.message
        });
      }

      // Test ordering and filtering
      const { data: orderedWorkflows, error: orderError } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      // Clean up
      for (const workflow of workflows) {
        await supabase
          .from('workflows')
          .delete()
          .eq('id', workflow.id);
      }

      return {
        testName: 'Workflow State Management Test',
        passed: !orderError,
        details: {
          createdWorkflows: workflows.length,
          statusQueries,
          ordering: {
            success: !orderError,
            count: orderedWorkflows?.length || 0
          }
        }
      };
    } catch (error: any) {
      return {
        testName: 'Workflow State Management Test',
        passed: false,
        error: error.message
      };
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('=== Running Workflow System Tests ===\n');
    
    const tests = [
      { name: 'Workflow Schema', test: workflowTest.testWorkflowSchema },
      { name: 'Workflow Creation', test: workflowTest.testWorkflowCreation },
      { name: 'Status Progression', test: workflowTest.testStatusProgression },
      { name: 'Agent Assignment', test: workflowTest.testAgentAssignment },
      { name: 'Progress Tracking', test: workflowTest.testProgressTracking },
      { name: 'State Management', test: workflowTest.testWorkflowStateManagement }
    ];

    const results: WorkflowTestResult[] = [];
    
    for (const { name, test } of tests) {
      console.log(`Running ${name}...`);
      const result = await test();
      results.push(result);
      
      console.log(`${result.passed ? '✅' : '❌'} ${name}`);
      if (result.error) {
        console.error(`   Error: ${result.error}`);
      }
      if (result.details) {
        console.log('   Details:', JSON.stringify(result.details, null, 2));
      }
      console.log('');
    }

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    
    console.log('\n=== Test Summary ===');
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    return {
      results,
      summary: {
        total: results.length,
        passed,
        failed,
        successRate: (passed / results.length) * 100
      }
    };
  }
};

// Export for browser console testing
if (typeof window !== 'undefined') {
  (window as any).workflowTest = workflowTest;
}