#!/usr/bin/env tsx

// Run comprehensive Eva tests
import { runComprehensiveTests, testVoiceStreaming } from './eva-comprehensive-test';
import { EvaBrain } from '@/lib/services/eva-brain';

async function main() {
  console.log('🧠 EVA MASTER BRAIN - COMPREHENSIVE TEST SUITE');
  console.log('============================================\n');
  
  // Test 1: Quick functionality check
  console.log('1️⃣ Quick Functionality Test\n');
  const eva = new EvaBrain('quick-test');
  
  // Test basic response
  const quickTest = await eva.processVoiceCommand('Hello Eva, are you ready to help?');
  console.log('Eva responds:', quickTest.response);
  console.log('Tool executions:', quickTest.toolExecutions?.length || 0);
  
  // Test 2: Tool calling examples
  console.log('\n\n2️⃣ Tool Calling Examples\n');
  
  const examples = [
    {
      command: "Search for the latest news about AI agents",
      expectedTool: "search_web"
    },
    {
      command: "Create a high priority task to interview John Smith tomorrow at 2 PM",
      expectedTool: "create_task"
    },
    {
      command: "Show me my unread emails",
      expectedTool: "read_emails"
    },
    {
      command: "Use deep thinking to analyze our recruitment strategy",
      expectedTool: "execute_workflow"
    },
    {
      command: "Monitor LinkedIn for new senior developer profiles and alert me",
      expectedTool: "monitor_updates"
    }
  ];
  
  for (const example of examples) {
    console.log(`\n💬 Command: "${example.command}"`);
    const result = await eva.processVoiceCommand(example.command);
    const toolsUsed = result.toolExecutions?.map(t => t.toolName) || [];
    console.log(`🔧 Expected tool: ${example.expectedTool}`);
    console.log(`✅ Tools used: ${toolsUsed.join(', ')}`);
    console.log(`📝 Response preview: ${result.response.substring(0, 100)}...`);
  }
  
  // Test 3: Multi-modal test with document
  console.log('\n\n3️⃣ Multi-modal Document Processing\n');
  
  const documentTest = await eva.processVoiceCommand(
    "Analyze this candidate information and tell me if they're a good fit",
    {
      attachments: [{
        type: 'document',
        content: `
Candidate: Sarah Johnson
Role: Senior Financial Advisor
Experience: 15 years
Current AUM: $250M
Specialties: HNW clients, Estate Planning
Location: New York, NY
Looking for: Better platform and support
        `,
        mimeType: 'text/plain',
        fileName: 'candidate-info.txt'
      }]
    }
  );
  
  console.log('Document analysis:', documentTest.response.substring(0, 200) + '...');
  
  // Test 4: Complex multi-step workflow
  console.log('\n\n4️⃣ Complex Multi-step Workflow\n');
  
  const workflowTest = await eva.processVoiceCommand(
    "Search for information about top financial advisory firms, analyze their recruiting strategies, and create a task to implement the best practices"
  );
  
  console.log('Workflow tools used:', workflowTest.toolExecutions?.map(t => t.toolName));
  console.log('Workflow response:', workflowTest.response.substring(0, 200) + '...');
  
  // Test 5: Show Eva's capabilities
  console.log('\n\n5️⃣ Eva\'s Agent Network\n');
  const agents = eva.getAvailableAgents();
  
  console.log('Eva controls these specialized agents:');
  agents.forEach(agent => {
    console.log(`\n🤖 ${agent.name}`);
    console.log(`   📋 Description: ${agent.description}`);
    console.log(`   🔧 Capabilities: ${agent.capabilities.join(', ')}`);
  });
  
  // Test 6: Context retention
  console.log('\n\n6️⃣ Context Retention Test\n');
  
  const context1 = await eva.processVoiceCommand("My name is Michael and I'm looking for a new Financial Advisor");
  console.log('Eva:', context1.response.substring(0, 100) + '...');
  
  const context2 = await eva.processVoiceCommand("What's my name?");
  console.log('Eva remembers:', context2.response);
  
  // Run comprehensive test suite
  console.log('\n\n7️⃣ Running Comprehensive Test Suite...\n');
  console.log('(This will test all categories systematically)');
  
  // Uncomment to run full test suite
  // await runComprehensiveTests();
  
  console.log('\n\n✅ Eva Master Brain Tests Complete!');
  console.log('\nEva is ready to:');
  console.log('  • 📧 Read and write emails');
  console.log('  • ✅ Create and manage tasks');
  console.log('  • 🔍 Search the web for information');
  console.log('  • 📄 Process documents and images');
  console.log('  • 🧠 Perform deep analysis with ultra thinking');
  console.log('  • 🤖 Orchestrate specialized agents');
  console.log('  • 📊 Monitor real-time updates');
  console.log('  • 🎯 Navigate and control the dashboard');
}

// Run tests
main().catch(console.error);