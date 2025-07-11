import { supabase } from './client';
import { Database } from './client';
import { TaskStatus } from '@/types/database';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

// Task Management Test Suite
export const taskManagementTest = {
  // Test task creation with various scenarios
  testTaskCreation: async () => {
    console.log('=== Testing Task Creation ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Test 1: Create basic task
      console.log('1. Creating basic task...');
      const basicTask: TaskInsert = {
        user_id: user.id,
        title: 'Basic Test Task',
        description: 'Testing basic task creation',
        priority: 0.5,
        status: TaskStatus.pending
      };
      
      const { data: task1, error: error1 } = await supabase
        .from('tasks')
        .insert(basicTask)
        .select()
        .single();
      
      results.push({
        test: 'Basic task creation',
        success: !error1,
        data: task1,
        error: error1
      });

      // Test 2: Create task with all fields
      console.log('2. Creating task with all fields...');
      const fullTask: TaskInsert = {
        user_id: user.id,
        title: 'Complete Test Task',
        description: 'Testing task with all fields populated',
        priority: 0.9,
        status: TaskStatus.pending,
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        assigned_agent: 'research-agent',
        metadata: {
          category: 'urgent',
          tags: ['test', 'high-priority'],
          source: 'api-test'
        }
      };
      
      const { data: task2, error: error2 } = await supabase
        .from('tasks')
        .insert(fullTask)
        .select()
        .single();
      
      results.push({
        test: 'Full task creation',
        success: !error2,
        data: task2,
        error: error2
      });

      // Test 3: Create task with invalid data
      console.log('3. Testing validation - invalid status...');
      const invalidTask: any = {
        user_id: user.id,
        title: 'Invalid Status Task',
        status: 'invalid_status' // This should fail
      };
      
      const { data: task3, error: error3 } = await supabase
        .from('tasks')
        .insert(invalidTask)
        .select()
        .single();
      
      results.push({
        test: 'Invalid status validation',
        success: !!error3, // We expect this to fail
        expectedError: true,
        error: error3
      });

      // Test 4: Create task with missing required fields
      console.log('4. Testing validation - missing title...');
      const missingFieldTask: any = {
        user_id: user.id,
        description: 'Task without title'
      };
      
      const { data: task4, error: error4 } = await supabase
        .from('tasks')
        .insert(missingFieldTask)
        .select()
        .single();
      
      results.push({
        test: 'Missing required field validation',
        success: !!error4, // We expect this to fail
        expectedError: true,
        error: error4
      });

      // Test 5: Create task with priority out of range
      console.log('5. Testing validation - priority out of range...');
      const outOfRangeTask: TaskInsert = {
        user_id: user.id,
        title: 'Priority Out of Range Task',
        priority: 1.5 // Should be between 0 and 1
      };
      
      const { data: task5, error: error5 } = await supabase
        .from('tasks')
        .insert(outOfRangeTask)
        .select()
        .single();
      
      results.push({
        test: 'Priority range validation',
        success: !error5, // Check if database allows this
        data: task5,
        error: error5
      });

      // Cleanup created tasks
      const createdTaskIds = results
        .filter(r => r.data?.id && !r.expectedError)
        .map(r => r.data.id);
      
      if (createdTaskIds.length > 0) {
        await supabase
          .from('tasks')
          .delete()
          .in('id', createdTaskIds);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Task creation tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Test task status workflow
  testTaskStatusWorkflow: async () => {
    console.log('\n=== Testing Task Status Workflow ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Create a test task
      const { data: task, error: createError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: 'Status Workflow Test Task',
          description: 'Testing status transitions',
          status: TaskStatus.pending
        })
        .select()
        .single();
      
      if (createError) throw createError;

      // Test valid status transitions
      const validTransitions = [
        { from: TaskStatus.pending, to: TaskStatus.in_progress },
        { from: TaskStatus.in_progress, to: TaskStatus.completed }
      ];

      for (const transition of validTransitions) {
        console.log(`Testing transition: ${transition.from} -> ${transition.to}`);
        
        const { data: updatedTask, error: updateError } = await supabase
          .from('tasks')
          .update({ 
            status: transition.to as any,
            completed_at: transition.to === 'completed' ? new Date().toISOString() : null
          })
          .eq('id', task.id)
          .select()
          .single();
        
        results.push({
          test: `Status transition: ${transition.from} -> ${transition.to}`,
          success: !updateError,
          data: updatedTask,
          error: updateError
        });
      }

      // Test cancelled status
      console.log('Testing cancelled status...');
      const { data: cancelledTask, error: cancelError } = await supabase
        .from('tasks')
        .update({ status: 'cancelled' })
        .eq('id', task.id)
        .select()
        .single();
      
      results.push({
        test: 'Cancel task',
        success: !cancelError,
        data: cancelledTask,
        error: cancelError
      });

      // Test invalid status
      console.log('Testing invalid status transition...');
      const { data: invalidStatus, error: invalidError } = await supabase
        .from('tasks')
        .update({ status: 'invalid_status' as any })
        .eq('id', task.id)
        .select()
        .single();
      
      results.push({
        test: 'Invalid status validation',
        success: !!invalidError, // We expect this to fail
        expectedError: true,
        error: invalidError
      });

      // Cleanup
      await supabase.from('tasks').delete().eq('id', task.id);

      return { success: true, results };
    } catch (error) {
      console.error('Status workflow tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Test task assignment to agents
  testTaskAssignment: async () => {
    console.log('\n=== Testing Task Assignment ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Create tasks for different agents
      const agents = [
        'research-agent',
        'email-agent',
        'calendar-agent',
        'content-agent',
        'workflow-agent'
      ];

      const taskPromises = agents.map(agent => 
        supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Task for ${agent}`,
            description: `Testing assignment to ${agent}`,
            assigned_agent: agent,
            status: TaskStatus.pending
          })
          .select()
          .single()
      );

      const taskResults = await Promise.all(taskPromises);
      const createdTasks: Task[] = [];

      taskResults.forEach((result, index) => {
        results.push({
          test: `Assign task to ${agents[index]}`,
          success: !result.error,
          data: result.data,
          error: result.error
        });
        if (result.data) createdTasks.push(result.data);
      });

      // Test querying tasks by agent
      for (const agent of agents) {
        console.log(`Querying tasks for ${agent}...`);
        const { data: agentTasks, error: queryError } = await supabase
          .from('tasks')
          .select('*')
          .eq('user_id', user.id)
          .eq('assigned_agent', agent);
        
        results.push({
          test: `Query tasks for ${agent}`,
          success: !queryError && agentTasks && agentTasks.length > 0,
          count: agentTasks?.length || 0,
          error: queryError
        });
      }

      // Test reassignment
      if (createdTasks.length > 0) {
        console.log('Testing task reassignment...');
        const { data: reassigned, error: reassignError } = await supabase
          .from('tasks')
          .update({ assigned_agent: 'workflow-agent' })
          .eq('id', createdTasks[0].id)
          .select()
          .single();
        
        results.push({
          test: 'Reassign task to different agent',
          success: !reassignError,
          data: reassigned,
          error: reassignError
        });
      }

      // Cleanup
      const taskIds = createdTasks.map(t => t.id);
      if (taskIds.length > 0) {
        await supabase.from('tasks').delete().in('id', taskIds);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Task assignment tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Test priority handling
  testPriorityHandling: async () => {
    console.log('\n=== Testing Priority Handling ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Create tasks with different priorities
      const priorities = [0, 0.25, 0.5, 0.75, 1];
      const taskPromises = priorities.map(priority => 
        supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Priority ${priority} Task`,
            description: `Testing priority level ${priority}`,
            priority: priority,
            status: TaskStatus.pending
          })
          .select()
          .single()
      );

      const taskResults = await Promise.all(taskPromises);
      const createdTasks: Task[] = [];

      taskResults.forEach((result, index) => {
        results.push({
          test: `Create task with priority ${priorities[index]}`,
          success: !result.error,
          data: result.data,
          error: result.error
        });
        if (result.data) createdTasks.push(result.data);
      });

      // Test querying tasks ordered by priority
      console.log('Testing priority ordering...');
      const { data: orderedTasks, error: orderError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .limit(5);
      
      results.push({
        test: 'Query tasks ordered by priority',
        success: !orderError && orderedTasks && orderedTasks.length > 0,
        correctOrder: orderedTasks ? 
          orderedTasks.every((task, i) => 
            i === 0 || task.priority <= orderedTasks[i-1].priority
          ) : false,
        data: orderedTasks,
        error: orderError
      });

      // Test filtering by priority range
      console.log('Testing priority range filtering...');
      const { data: highPriorityTasks, error: filterError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('priority', 0.7)
        .lte('priority', 1);
      
      results.push({
        test: 'Filter high priority tasks (>= 0.7)',
        success: !filterError,
        count: highPriorityTasks?.length || 0,
        data: highPriorityTasks,
        error: filterError
      });

      // Cleanup
      const taskIds = createdTasks.map(t => t.id);
      if (taskIds.length > 0) {
        await supabase.from('tasks').delete().in('id', taskIds);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Priority handling tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Test due date management
  testDueDateManagement: async () => {
    console.log('\n=== Testing Due Date Management ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Create tasks with different due dates
      const now = new Date();
      const dueDates = [
        { label: 'Overdue', date: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        { label: 'Due Today', date: now },
        { label: 'Due Tomorrow', date: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        { label: 'Due Next Week', date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        { label: 'No Due Date', date: null }
      ];

      const taskPromises = dueDates.map(({ label, date }) => 
        supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `${label} Task`,
            description: `Testing due date: ${label}`,
            due_date: date?.toISOString() || null,
            status: TaskStatus.pending
          })
          .select()
          .single()
      );

      const taskResults = await Promise.all(taskPromises);
      const createdTasks: Task[] = [];

      taskResults.forEach((result, index) => {
        results.push({
          test: `Create task: ${dueDates[index].label}`,
          success: !result.error,
          data: result.data,
          error: result.error
        });
        if (result.data) createdTasks.push(result.data);
      });

      // Test querying overdue tasks
      console.log('Testing overdue tasks query...');
      const { data: overdueTasks, error: overdueError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .lt('due_date', now.toISOString())
        .eq('status', TaskStatus.pending);
      
      results.push({
        test: 'Query overdue tasks',
        success: !overdueError,
        count: overdueTasks?.length || 0,
        data: overdueTasks,
        error: overdueError
      });

      // Test querying tasks due today
      console.log('Testing tasks due today...');
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: todayTasks, error: todayError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('due_date', startOfDay.toISOString())
        .lte('due_date', endOfDay.toISOString());
      
      results.push({
        test: 'Query tasks due today',
        success: !todayError,
        count: todayTasks?.length || 0,
        data: todayTasks,
        error: todayError
      });

      // Test ordering by due date
      console.log('Testing due date ordering...');
      const { data: orderedByDueDate, error: orderError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsFirst: false });
      
      results.push({
        test: 'Order tasks by due date',
        success: !orderError,
        count: orderedByDueDate?.length || 0,
        data: orderedByDueDate,
        error: orderError
      });

      // Cleanup
      const taskIds = createdTasks.map(t => t.id);
      if (taskIds.length > 0) {
        await supabase.from('tasks').delete().in('id', taskIds);
      }

      return { success: true, results };
    } catch (error) {
      console.error('Due date management tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Test data validation and constraints
  testDataValidation: async () => {
    console.log('\n=== Testing Data Validation ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Test 1: Priority constraints
      console.log('Testing priority constraints...');
      const priorityTests = [
        { value: -0.5, expected: 'fail' },
        { value: 0, expected: 'pass' },
        { value: 0.5, expected: 'pass' },
        { value: 1, expected: 'pass' },
        { value: 1.5, expected: 'fail' }
      ];

      for (const test of priorityTests) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Priority ${test.value} Test`,
            priority: test.value
          })
          .select()
          .single();
        
        results.push({
          test: `Priority ${test.value}`,
          success: test.expected === 'pass' ? !error : !!error,
          expected: test.expected,
          data: data,
          error: error
        });

        if (data) {
          await supabase.from('tasks').delete().eq('id', data.id);
        }
      }

      // Test 2: Status enum validation
      console.log('Testing status enum validation...');
      const statusTests = [
        { value: TaskStatus.pending, expected: 'pass' },
        { value: TaskStatus.in_progress, expected: 'pass' },
        { value: TaskStatus.completed, expected: 'pass' },
        { value: TaskStatus.cancelled, expected: 'pass' },
        { value: 'invalid', expected: 'fail' },
        { value: '', expected: 'fail' },
        { value: null, expected: 'pass' } // Should default to pending
      ];

      for (const test of statusTests) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Status ${test.value} Test`,
            status: test.value as any
          })
          .select()
          .single();
        
        results.push({
          test: `Status "${test.value}"`,
          success: test.expected === 'pass' ? !error : !!error,
          expected: test.expected,
          data: data,
          error: error
        });

        if (data) {
          await supabase.from('tasks').delete().eq('id', data.id);
        }
      }

      // Test 3: Metadata JSON validation
      console.log('Testing metadata JSON validation...');
      const metadataTests = [
        { value: {}, expected: 'pass' },
        { value: { key: 'value' }, expected: 'pass' },
        { value: { nested: { object: true } }, expected: 'pass' },
        { value: ['array'], expected: 'pass' }, // Arrays should be wrapped in object
        { value: null, expected: 'pass' } // Should default to {}
      ];

      for (const test of metadataTests) {
        const { data, error } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: `Metadata Test`,
            metadata: test.value as any
          })
          .select()
          .single();
        
        results.push({
          test: `Metadata ${JSON.stringify(test.value)}`,
          success: !error,
          expected: test.expected,
          data: data,
          error: error
        });

        if (data) {
          await supabase.from('tasks').delete().eq('id', data.id);
        }
      }

      return { success: true, results };
    } catch (error) {
      console.error('Data validation tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Test real-time updates for tasks
  testRealtimeTaskUpdates: async () => {
    console.log('\n=== Testing Real-time Task Updates ===\n');
    const results: any[] = [];
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      return new Promise((resolve) => {
        let updateCount = 0;
        const expectedUpdates = 3;

        // Subscribe to task changes
        const channel = supabase
          .channel('task-updates-test')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'tasks',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Received real-time update:', payload);
              results.push({
                test: `Real-time ${payload.eventType}`,
                success: true,
                payload: payload
              });

              updateCount++;
              if (updateCount >= expectedUpdates) {
                channel.unsubscribe();
                resolve({ success: true, results });
              }
            }
          )
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              console.log('Subscribed to task updates, performing operations...');

              // Create a task
              const { data: task } = await supabase
                .from('tasks')
                .insert({
                  user_id: user.id,
                  title: 'Real-time Test Task',
                  status: TaskStatus.pending
                })
                .select()
                .single();

              if (task) {
                // Update the task
                await supabase
                  .from('tasks')
                  .update({ status: TaskStatus.in_progress })
                  .eq('id', task.id);

                // Delete the task
                await supabase
                  .from('tasks')
                  .delete()
                  .eq('id', task.id);
              }
            }
          });

        // Timeout after 10 seconds
        setTimeout(() => {
          channel.unsubscribe();
          resolve({ 
            success: false, 
            error: 'Real-time updates timeout',
            results 
          });
        }, 10000);
      });
    } catch (error) {
      console.error('Real-time task update tests failed:', error);
      return { success: false, error, results };
    }
  },

  // Run all task management tests
  runAllTests: async () => {
    console.log('=== Running All Task Management Tests ===\n');
    
    const testSuites = [
      { name: 'Task Creation', test: taskManagementTest.testTaskCreation },
      { name: 'Status Workflow', test: taskManagementTest.testTaskStatusWorkflow },
      { name: 'Task Assignment', test: taskManagementTest.testTaskAssignment },
      { name: 'Priority Handling', test: taskManagementTest.testPriorityHandling },
      { name: 'Due Date Management', test: taskManagementTest.testDueDateManagement },
      { name: 'Data Validation', test: taskManagementTest.testDataValidation },
      { name: 'Real-time Updates', test: taskManagementTest.testRealtimeTaskUpdates }
    ];

    const allResults: any = {};

    for (const suite of testSuites) {
      console.log(`\nRunning ${suite.name} tests...`);
      allResults[suite.name] = await suite.test();
    }

    // Summary
    console.log('\n=== Test Summary ===');
    Object.entries(allResults).forEach(([name, result]: [string, any]) => {
      console.log(`${name}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
      if (!result.success && result.error) {
        console.error(`  Error: ${result.error}`);
      }
      if (result.results) {
        const passed = result.results.filter((r: any) => r.success).length;
        const total = result.results.length;
        console.log(`  Details: ${passed}/${total} tests passed`);
      }
    });

    return allResults;
  }
};

// Make it available in browser console
if (typeof window !== 'undefined') {
  (window as any).taskManagementTest = taskManagementTest;
  console.log('Task Management Test Suite loaded. Available commands:');
  console.log('- taskManagementTest.testTaskCreation()');
  console.log('- taskManagementTest.testTaskStatusWorkflow()');
  console.log('- taskManagementTest.testTaskAssignment()');
  console.log('- taskManagementTest.testPriorityHandling()');
  console.log('- taskManagementTest.testDueDateManagement()');
  console.log('- taskManagementTest.testDataValidation()');
  console.log('- taskManagementTest.testRealtimeTaskUpdates()');
  console.log('- taskManagementTest.runAllTests()');
}