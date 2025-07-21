// Eva Voice Agent Full Test Script
// Tests all capabilities including web search with Firecrawl API

const TEST_QUERIES = [
  // Basic conversation
  "Hi Eva, can you hear me?",
  
  // Web search tests
  "What's the current price of XRP?",
  "Search for the latest AI news today",
  "Find information about quantum computing breakthroughs",
  "What's happening with SpaceX launches?",
  
  // Task management
  "Create a task to review candidate applications tomorrow at 2 PM",
  "Update my task list with high priority items",
  
  // Email operations
  "Check my unread emails",
  "Draft an email to the team about the meeting",
  
  // Complex multi-tool scenarios
  "Search for remote work trends and create a task to implement best practices",
  "Find information about AI in recruiting and draft an email summary",
  
  // Document/image analysis
  "Analyze this resume for key skills", // Would need file upload
  "What's in this chart?", // Would need image upload
  
  // Navigation
  "Navigate to the deals page",
  "Show me the candidate pipeline",
  
  // Monitoring
  "Monitor cryptocurrency prices and alert me on changes",
  "Set up monitoring for AI industry news"
];

async function testEvaVoice() {
  console.log('🎤 Eva Voice Agent Test Suite');
  console.log('=============================\n');
  
  // Check if we're on the Talk to Eva page
  if (!window.location.pathname.includes('/talk-to-eva')) {
    console.log('❌ Please navigate to http://localhost:3000/dashboard/talk-to-eva');
    return;
  }
  
  console.log('✅ On Talk to Eva page');
  
  // Check for voice session
  const connectButton = document.querySelector('button:has-text("Connect")');
  if (connectButton) {
    console.log('⚡ Click the Connect button to start voice session');
    return;
  }
  
  // Look for active voice indicators
  const isConnected = document.querySelector('[data-testid="voice-connected"]') || 
                     document.querySelector('.text-green-500') ||
                     document.body.textContent.includes('Connected');
  
  if (!isConnected) {
    console.log('❌ Voice session not connected. Please connect first.');
    return;
  }
  
  console.log('✅ Voice session connected');
  
  // Test tool execution tracking
  console.log('\n📊 Monitoring Tool Executions:');
  console.log('================================');
  
  // Monitor for tool icons
  const toolIcons = {
    '🔍': 'search_web',
    '✅': 'create_task',
    '📧': 'read_emails / write_email',
    '⚡': 'execute_workflow',
    '📍': 'navigate_dashboard',
    '📊': 'query_data',
    '🔔': 'monitor_updates'
  };
  
  // Create observer for tool executions
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const text = node.textContent || '';
            
            // Check for tool execution indicators
            Object.entries(toolIcons).forEach(([icon, tool]) => {
              if (text.includes(icon) || text.includes(tool)) {
                console.log(`\n🛠️ Tool Executed: ${tool}`);
                console.log(`   Icon: ${icon}`);
                console.log(`   Time: ${new Date().toLocaleTimeString()}`);
              }
            });
            
            // Check for Eva's responses
            if (text.includes('Eva:') || node.classList?.contains('assistant-message')) {
              console.log(`\n💬 Eva Response: ${text.substring(0, 100)}...`);
            }
          }
        });
      }
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('\n🎯 Test Queries to Try:');
  console.log('======================');
  
  TEST_QUERIES.forEach((query, index) => {
    console.log(`${index + 1}. "${query}"`);
  });
  
  console.log('\n📋 Test Checklist:');
  console.log('==================');
  console.log('[ ] Voice connection established');
  console.log('[ ] Eva responds to greeting');
  console.log('[ ] Web search returns results');
  console.log('[ ] Task creation works');
  console.log('[ ] Email operations function');
  console.log('[ ] Multi-tool orchestration succeeds');
  console.log('[ ] Navigation commands work');
  console.log('[ ] Monitoring setup works');
  
  console.log('\n🔧 Manual Testing Instructions:');
  console.log('==============================');
  console.log('1. Speak each test query naturally');
  console.log('2. Watch for tool execution icons');
  console.log('3. Verify Eva\'s responses are relevant');
  console.log('4. Check that actions are completed');
  
  // Test API availability
  console.log('\n🔌 API Status Check:');
  console.log('===================');
  
  // Check for Firecrawl API
  if (process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY) {
    console.log('✅ Firecrawl API key configured');
  } else {
    console.log('⚠️ Firecrawl API key not found - web search may be limited');
  }
  
  // Return test results object
  return {
    page: 'Talk to Eva',
    connected: !!isConnected,
    timestamp: new Date().toISOString(),
    testQueries: TEST_QUERIES,
    monitoringActive: true
  };
}

// Auto-run test
testEvaVoice().then(results => {
  console.log('\n📊 Test Results:', results);
  
  // Listen for Eva's events
  window.addEventListener('eva:tool_execution', (e) => {
    console.log('🛠️ Tool Execution Event:', e.detail);
  });
  
  window.addEventListener('eva:response', (e) => {
    console.log('💬 Eva Response Event:', e.detail);
  });
}).catch(error => {
  console.error('❌ Test Error:', error);
});

// Export for use in console
window.evaTest = {
  runTest: testEvaVoice,
  queries: TEST_QUERIES,
  simulateQuery: (query) => {
    console.log(`🎤 Simulating: "${query}"`);
    // This would need to integrate with the actual voice input
  }
};