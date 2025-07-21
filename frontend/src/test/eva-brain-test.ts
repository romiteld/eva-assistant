// Test Eva Brain Enhanced Capabilities
import { EvaBrain } from '@/lib/services/eva-brain';

async function testEvaBrain() {
  console.log('🧠 Testing Eva Brain Enhanced Capabilities...\n');
  
  // Initialize Eva Brain
  const eva = new EvaBrain('test-session-' + Date.now());
  
  // Test 1: Basic conversation
  console.log('1️⃣ Testing basic conversation...');
  const response1 = await eva.processVoiceCommand('Hello Eva, how are you today?');
  console.log('Response:', response1.response.substring(0, 100) + '...');
  console.log('Tool executions:', response1.toolExecutions?.length || 0, '\n');
  
  // Test 2: Web search capability
  console.log('2️⃣ Testing web search...');
  const response2 = await eva.processVoiceCommand('Eva, search for the latest AI news');
  console.log('Response:', response2.response.substring(0, 100) + '...');
  console.log('Tool executions:', response2.toolExecutions);
  console.log('Search tool used:', response2.toolExecutions?.some(t => t.toolName === 'search_web'), '\n');
  
  // Test 3: Task creation
  console.log('3️⃣ Testing task creation...');
  const response3 = await eva.processVoiceCommand('Eva, create a high priority task to review AI research papers tomorrow');
  console.log('Response:', response3.response.substring(0, 100) + '...');
  console.log('Tool executions:', response2.toolExecutions);
  console.log('Task tool used:', response3.toolExecutions?.some(t => t.toolName === 'create_task'), '\n');
  
  // Test 4: Email capability
  console.log('4️⃣ Testing email reading...');
  const response4 = await eva.processVoiceCommand('Eva, show me my unread emails');
  console.log('Response:', response4.response.substring(0, 100) + '...');
  console.log('Tool executions:', response4.toolExecutions);
  console.log('Email tool used:', response4.toolExecutions?.some(t => t.toolName === 'read_emails'), '\n');
  
  // Test 5: Agent orchestration
  console.log('5️⃣ Testing agent orchestration...');
  const response5 = await eva.processVoiceCommand('Eva, use the deep thinking agent to analyze the pros and cons of remote work');
  console.log('Response:', response5.response.substring(0, 100) + '...');
  console.log('Tool executions:', response5.toolExecutions);
  console.log('Workflow tool used:', response5.toolExecutions?.some(t => t.toolName === 'execute_workflow'), '\n');
  
  // Test 6: Complex multi-tool scenario
  console.log('6️⃣ Testing complex multi-tool scenario...');
  const response6 = await eva.processVoiceCommand('Eva, search for information about AI agents, then create a task to research them further');
  console.log('Response:', response6.response.substring(0, 100) + '...');
  console.log('Tool executions:', response6.toolExecutions?.map(t => t.toolName));
  console.log('Multiple tools used:', (response6.toolExecutions?.length || 0) > 1, '\n');
  
  // Get available agents
  console.log('🤖 Available Agents:');
  const agents = eva.getAvailableAgents();
  agents.forEach(agent => {
    console.log(`- ${agent.name}: ${agent.description}`);
  });
  
  console.log('\n✅ Eva Brain test complete!');
}

// Run the test
testEvaBrain().catch(console.error);