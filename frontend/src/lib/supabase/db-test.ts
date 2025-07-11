import { supabase } from './client';
import { realtimeHelpers } from './client';

// Database test utilities
export const dbTestUtils = {
  // Test database connection
  testConnection: async () => {
    console.log('Testing database connection...');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) throw error;
      console.log('✅ Database connection successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return { success: false, error };
    }
  },

  // Test real-time subscriptions
  testRealtimeSubscriptions: async () => {
    console.log('Testing real-time subscriptions...');
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        return { success: false, error: 'Not authenticated' };
      }

      console.log('Setting up real-time listeners for user:', user.id);

      // Subscribe to conversations
      const conversationChannel = realtimeHelpers.subscribeToConversations(
        user.id,
        (payload) => {
          console.log('📨 Conversation update:', payload);
        }
      );

      // Subscribe to tasks
      const taskChannel = realtimeHelpers.subscribeToTasks(
        user.id,
        (payload) => {
          console.log('📋 Task update:', payload);
        }
      );

      // Subscribe to workflows
      const workflowChannel = realtimeHelpers.subscribeToWorkflows(
        user.id,
        (payload) => {
          console.log('🔄 Workflow update:', payload);
        }
      );

      console.log('✅ Real-time subscriptions active');
      console.log('Try creating/updating records to see real-time updates');

      // Return cleanup function
      return {
        success: true,
        cleanup: () => {
          conversationChannel.unsubscribe();
          taskChannel.unsubscribe();
          workflowChannel.unsubscribe();
          console.log('Real-time subscriptions cleaned up');
        }
      };
    } catch (error) {
      console.error('❌ Real-time subscription setup failed:', error);
      return { success: false, error };
    }
  },

  // Test presence tracking
  testPresence: async () => {
    console.log('Testing presence tracking...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        return { success: false, error: 'Not authenticated' };
      }

      const presenceChannel = realtimeHelpers.trackPresence(user.id, {
        status: 'online',
        browser: navigator.userAgent
      });

      console.log('✅ Presence tracking active');
      
      return {
        success: true,
        channel: presenceChannel
      };
    } catch (error) {
      console.error('❌ Presence tracking failed:', error);
      return { success: false, error };
    }
  },

  // Test CRUD operations
  testCrudOperations: async () => {
    console.log('Testing CRUD operations...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        return { success: false, error: 'Not authenticated' };
      }

      // Test creating a task
      console.log('\n1. Creating a test task...');
      const { data: task, error: createError } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: 'Test Task',
          description: 'This is a test task created by dbTestUtils',
          priority: 0.5,
          status: 'pending'
        })
        .select()
        .single();

      if (createError) throw createError;
      console.log('✅ Task created:', task);

      // Test updating the task
      console.log('\n2. Updating the test task...');
      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update({
          status: 'in_progress',
          priority: 0.8
        })
        .eq('id', task.id)
        .select()
        .single();

      if (updateError) throw updateError;
      console.log('✅ Task updated:', updatedTask);

      // Test reading tasks
      console.log('\n3. Reading all tasks...');
      const { data: tasks, error: readError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (readError) throw readError;
      console.log(`✅ Found ${tasks.length} tasks`);

      // Test deleting the task
      console.log('\n4. Deleting the test task...');
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (deleteError) throw deleteError;
      console.log('✅ Task deleted');

      return { success: true };
    } catch (error) {
      console.error('❌ CRUD operations failed:', error);
      return { success: false, error };
    }
  },

  // Test storage
  testStorage: async () => {
    console.log('Testing storage bucket...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user found');
        return { success: false, error: 'Not authenticated' };
      }

      // Create a test file
      const testContent = 'This is a test file for storage testing';
      const blob = new Blob([testContent], { type: 'text/plain' });
      const file = new File([blob], 'test-file.txt', { type: 'text/plain' });

      // Upload file
      console.log('Uploading test file...');
      const fileName = `${user.id}/test-${Date.now()}.txt`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      console.log('✅ File uploaded:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);
      console.log('Public URL:', publicUrl);

      // Delete file
      console.log('Deleting test file...');
      const { error: deleteError } = await supabase.storage
        .from('documents')
        .remove([fileName]);

      if (deleteError) throw deleteError;
      console.log('✅ File deleted');

      return { success: true };
    } catch (error) {
      console.error('❌ Storage test failed:', error);
      return { success: false, error };
    }
  },

  // Run all tests
  runAllTests: async () => {
    console.log('=== Running All Database Tests ===\n');
    
    const results = {
      connection: await dbTestUtils.testConnection(),
      crud: await dbTestUtils.testCrudOperations(),
      storage: await dbTestUtils.testStorage(),
      realtime: await dbTestUtils.testRealtimeSubscriptions(),
      presence: await dbTestUtils.testPresence()
    };

    console.log('\n=== Test Results ===');
    Object.entries(results).forEach(([test, result]) => {
      console.log(`${test}: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
    });

    return results;
  }
};

// Make it available in browser console for testing
if (typeof window !== 'undefined') {
  (window as any).dbTestUtils = dbTestUtils;
  console.log('Database test utilities loaded. Available commands:');
  console.log('- dbTestUtils.testConnection()');
  console.log('- dbTestUtils.testCrudOperations()');
  console.log('- dbTestUtils.testStorage()');
  console.log('- dbTestUtils.testRealtimeSubscriptions()');
  console.log('- dbTestUtils.testPresence()');
  console.log('- dbTestUtils.runAllTests()');
}