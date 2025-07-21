// Comprehensive Eva Voice Agent Test Suite
import { EvaBrain } from '@/lib/services/eva-brain';
import { supabaseVoiceStreaming } from '@/lib/services/supabase-voice-streaming';

// Test scenarios for Eva's enhanced capabilities
export const testScenarios = {
  // 1. Basic Conversation Tests
  conversationTests: [
    {
      name: "Basic Greeting",
      input: "Hello Eva, how are you today?",
      expectedCapabilities: ['natural_response'],
      description: "Tests basic conversational ability"
    },
    {
      name: "Context Retention",
      inputs: [
        "My name is John and I work at TechCorp",
        "What's my name?",
        "Where do I work?"
      ],
      expectedCapabilities: ['context_retention', 'memory'],
      description: "Tests if Eva remembers context from previous messages"
    },
    {
      name: "Multi-turn Conversation",
      inputs: [
        "I need help planning a recruitment campaign",
        "Let's focus on software engineers",
        "What strategies would you recommend?"
      ],
      expectedCapabilities: ['conversation_flow', 'strategic_thinking'],
      description: "Tests multi-turn conversation handling"
    }
  ],

  // 2. Web Search and Information Lookup
  webSearchTests: [
    {
      name: "Current News Search",
      input: "Eva, what are the latest AI developments in 2024?",
      expectedTools: ['search_web'],
      description: "Tests real-time web search capability"
    },
    {
      name: "Specific Information Lookup",
      input: "Search for information about OpenAI's latest model releases",
      expectedTools: ['search_web'],
      description: "Tests targeted information retrieval"
    },
    {
      name: "Market Research",
      input: "Find current trends in financial advisor recruiting",
      expectedTools: ['search_web', 'execute_workflow'],
      description: "Tests domain-specific research capability"
    }
  ],

  // 3. Document and Image Processing
  documentTests: [
    {
      name: "Resume Analysis",
      input: "Analyze this resume and extract key skills",
      attachments: [{
        type: 'document',
        content: `John Doe
Senior Software Engineer
Skills: Python, JavaScript, React, Node.js, AWS
Experience: 5 years in full-stack development
Education: BS Computer Science, MIT`,
        mimeType: 'text/plain',
        fileName: 'resume.txt'
      }],
      expectedTools: ['execute_workflow'],
      expectedAgents: ['resume-parser-pipeline'],
      description: "Tests document processing capability"
    },
    {
      name: "Image Analysis",
      input: "What's in this image?",
      attachments: [{
        type: 'image',
        content: 'base64_encoded_image_data_here',
        mimeType: 'image/jpeg',
        fileName: 'chart.jpg'
      }],
      expectedCapabilities: ['vision', 'image_analysis'],
      description: "Tests image understanding capability"
    }
  ],

  // 4. Task Management
  taskTests: [
    {
      name: "Create Simple Task",
      input: "Create a task to follow up with Jane about the interview tomorrow",
      expectedTools: ['create_task'],
      description: "Tests basic task creation"
    },
    {
      name: "Create Complex Task",
      input: "Create a high priority task to review all candidate applications by Friday at 5 PM",
      expectedTools: ['create_task'],
      expectedParams: {
        priority: 'high',
        dueDate: 'friday_5pm'
      },
      description: "Tests task creation with parameters"
    },
    {
      name: "Update Task",
      input: "Mark task 123 as completed",
      expectedTools: ['update_task'],
      description: "Tests task update functionality"
    }
  ],

  // 5. Email Management
  emailTests: [
    {
      name: "Read Emails",
      input: "Show me my unread emails from today",
      expectedTools: ['read_emails'],
      expectedParams: {
        unreadOnly: true
      },
      description: "Tests email reading capability"
    },
    {
      name: "Compose Email",
      input: "Write an email to sarah@example.com about scheduling a meeting next week",
      expectedTools: ['write_email'],
      description: "Tests email composition"
    },
    {
      name: "Draft Email",
      input: "Draft an email to the team about the new recruitment process but don't send it",
      expectedTools: ['write_email'],
      expectedParams: {
        isDraft: true
      },
      description: "Tests email drafting"
    }
  ],

  // 6. Ultra Thinking and Deep Analysis
  ultraThinkingTests: [
    {
      name: "Complex Analysis",
      input: "Use deep thinking to analyze the pros and cons of remote work for our recruitment business",
      expectedTools: ['execute_workflow'],
      expectedAgents: ['deep-thinking-orchestrator'],
      description: "Tests ultra thinking capability"
    },
    {
      name: "Strategic Planning",
      input: "Help me create a comprehensive strategy for expanding into the healthcare recruitment market",
      expectedTools: ['execute_workflow'],
      expectedAgents: ['deep-thinking-orchestrator'],
      description: "Tests strategic analysis"
    },
    {
      name: "Multi-perspective Analysis",
      input: "Analyze our competitor's approach from multiple perspectives - candidate, client, and business",
      expectedTools: ['execute_workflow'],
      expectedAgents: ['deep-thinking-orchestrator'],
      description: "Tests multi-angle analysis"
    }
  ],

  // 7. Multi-Tool Orchestration
  orchestrationTests: [
    {
      name: "Research and Task Creation",
      input: "Search for best practices in executive recruiting and create a task to implement them",
      expectedTools: ['search_web', 'create_task'],
      description: "Tests multi-tool coordination"
    },
    {
      name: "Email and Calendar Integration",
      input: "Check my emails about the client meeting and create a calendar event for it",
      expectedTools: ['read_emails', 'execute_workflow'],
      description: "Tests cross-functional integration"
    },
    {
      name: "Full Workflow Automation",
      input: "Find potential candidates on LinkedIn for the senior developer role, analyze their profiles, and draft outreach emails",
      expectedTools: ['execute_workflow', 'search_web', 'write_email'],
      expectedAgents: ['lead-generation-agent', 'linkedin-enrichment'],
      description: "Tests complex workflow orchestration"
    }
  ],

  // 8. Real-time Monitoring
  monitoringTests: [
    {
      name: "Topic Monitoring",
      input: "Monitor news about AI in recruiting and notify me of updates",
      expectedTools: ['monitor_updates'],
      description: "Tests real-time monitoring setup"
    },
    {
      name: "Competitor Tracking",
      input: "Track updates from our competitor's websites daily",
      expectedTools: ['monitor_updates'],
      expectedParams: {
        frequency: 'daily'
      },
      description: "Tests scheduled monitoring"
    }
  ],

  // 9. Dashboard Navigation
  navigationTests: [
    {
      name: "Navigate to Page",
      input: "Take me to the deals page",
      expectedTools: ['navigate_dashboard'],
      expectedParams: {
        page: '/dashboard/deals'
      },
      description: "Tests navigation capability"
    },
    {
      name: "Open Specific Section",
      input: "Show me the candidate pipeline",
      expectedTools: ['navigate_dashboard'],
      description: "Tests contextual navigation"
    }
  ],

  // 10. Data Query and Analysis
  dataTests: [
    {
      name: "Query Candidates",
      input: "Show me all active candidates in the pipeline",
      expectedTools: ['query_data'],
      expectedParams: {
        table: 'candidates'
      },
      description: "Tests data querying"
    },
    {
      name: "Complex Data Analysis",
      input: "Analyze our placement success rate over the last quarter",
      expectedTools: ['query_data', 'execute_workflow'],
      description: "Tests data analysis capability"
    }
  ]
};

// Test runner function
export async function runComprehensiveTests() {
  console.log('🚀 Starting Comprehensive Eva Voice Agent Tests\n');
  
  const eva = new EvaBrain('test-session-' + Date.now());
  const results = {
    passed: 0,
    failed: 0,
    details: [] as any[]
  };

  // Helper function to run a single test
  async function runTest(category: string, test: any) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`📝 Description: ${test.description}`);
    
    try {
      // Handle single or multiple inputs
      const inputs = test.inputs || [test.input];
      let lastResponse: any;
      
      for (const input of inputs) {
        console.log(`💬 Input: "${input}"`);
        
        // Process with attachments if provided
        const response = await eva.processVoiceCommand(input, {
          attachments: test.attachments
        });
        
        console.log(`🤖 Response: ${response.response.substring(0, 150)}...`);
        
        // Check tool usage
        if (test.expectedTools) {
          const usedTools = response.toolExecutions?.map(t => t.toolName) || [];
          console.log(`🔧 Tools used: ${usedTools.join(', ')}`);
          
          const allToolsUsed = test.expectedTools.every((tool: string) => 
            usedTools.includes(tool)
          );
          
          if (!allToolsUsed) {
            throw new Error(`Expected tools ${test.expectedTools} but got ${usedTools}`);
          }
        }
        
        lastResponse = response;
      }
      
      results.passed++;
      results.details.push({
        category,
        test: test.name,
        status: 'PASSED',
        response: lastResponse
      });
      
      console.log('✅ PASSED');
      
    } catch (error) {
      results.failed++;
      results.details.push({
        category,
        test: test.name,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      console.log(`❌ FAILED: ${error}`);
    }
  }

  // Run all test categories
  for (const [category, tests] of Object.entries(testScenarios)) {
    console.log(`\n\n🏷️  Category: ${category.replace(/([A-Z])/g, ' $1').toUpperCase()}`);
    console.log('='.repeat(50));
    
    for (const test of tests) {
      await runTest(category, test);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log('\n\n📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(2)}%`);
  
  // Show available agents
  console.log('\n🤖 Available Agents for Eva:');
  const agents = eva.getAvailableAgents();
  agents.forEach(agent => {
    console.log(`  • ${agent.name}: ${agent.capabilities.join(', ')}`);
  });
  
  return results;
}

// Voice streaming test
export async function testVoiceStreaming() {
  console.log('\n\n🎤 Testing Voice Streaming Integration\n');
  
  // Test voice session
  const userId = 'test-user-' + Date.now();
  
  // Set up event listeners
  supabaseVoiceStreaming.on('connected', (sessionId) => {
    console.log(`✅ Connected with session: ${sessionId}`);
  });
  
  supabaseVoiceStreaming.on('transcript', (text) => {
    console.log(`🎤 Transcript: "${text}"`);
  });
  
  supabaseVoiceStreaming.on('response', (text) => {
    console.log(`🤖 Eva says: "${text}"`);
  });
  
  supabaseVoiceStreaming.on('functionCall', (data) => {
    console.log(`🔧 Function called: ${data.name} (${data.status})`);
  });
  
  supabaseVoiceStreaming.on('error', (error) => {
    console.error('❌ Error:', error);
  });
  
  try {
    // Start session
    await supabaseVoiceStreaming.startSession(userId);
    console.log('🎙️ Voice session started');
    
    // Simulate some voice commands
    const testCommands = [
      "Hello Eva",
      "Search for AI news",
      "Create a task to review candidates",
      "What's my schedule today?"
    ];
    
    for (const command of testCommands) {
      console.log(`\n💬 Simulating: "${command}"`);
      // In real usage, this would come from actual voice input
      supabaseVoiceStreaming.emit('transcript', command);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // End session
    await supabaseVoiceStreaming.endSession();
    console.log('\n🛑 Voice session ended');
    
  } catch (error) {
    console.error('Voice streaming test failed:', error);
  }
}

// Export for use in test files
export { testScenarios, runComprehensiveTests, testVoiceStreaming };