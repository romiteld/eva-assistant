#!/usr/bin/env node

/**
 * Integration Test Runner for AI Agents and External Services
 * This script validates all AI agents and their dependencies
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

// Load environment variables
config({ path: resolve(__dirname, '../.env.local') });

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

class IntegrationTester {
  private results: TestResult[] = [];

  async runAllTests() {
    console.log(chalk.blue.bold('\n🧪 EVA Assistant Integration Test Suite\n'));
    
    // Test 1: Environment Configuration
    await this.testEnvironmentConfig();
    
    // Test 2: API Keys
    await this.testAPIKeys();
    
    // Test 3: Database Connection
    await this.testDatabaseConnection();
    
    // Test 4: AI Agent Initialization
    await this.testAgentInitialization();
    
    // Test 5: External API Connectivity
    await this.testExternalAPIs();
    
    // Test 6: Edge Functions
    await this.testEdgeFunctions();
    
    // Display results
    this.displayResults();
  }

  private async testEnvironmentConfig() {
    console.log(chalk.yellow('🔧 Testing Environment Configuration...'));
    
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GEMINI_API_KEY',
      'NEXT_PUBLIC_FIRECRAWL_API_KEY',
      'ZOHO_CLIENT_ID',
      'ZOHO_CLIENT_SECRET',
    ];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.results.push({
          name: `Environment: ${envVar}`,
          status: 'pass',
          message: 'Configured',
          details: envVar.includes('KEY') || envVar.includes('SECRET') 
            ? '***hidden***' 
            : process.env[envVar]?.substring(0, 20) + '...'
        });
      } else {
        this.results.push({
          name: `Environment: ${envVar}`,
          status: 'fail',
          message: 'Not configured'
        });
      }
    }
  }

  private async testAPIKeys() {
    console.log(chalk.yellow('\n🔑 Testing API Key Validity...'));
    
    // Test Gemini API Key
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        // Simple test to verify API key works
        await model.generateContent('Test');
        
        this.results.push({
          name: 'Gemini API Key',
          status: 'pass',
          message: 'Valid and working'
        });
      } catch (error) {
        this.results.push({
          name: 'Gemini API Key',
          status: 'fail',
          message: 'Invalid or not working',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test Firecrawl API Key
    if (process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY) {
      try {
        const FirecrawlApp = (await import('@mendable/firecrawl-js')).default;
        const firecrawl = new FirecrawlApp({ 
          apiKey: process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY 
        });
        
        // Note: Can't test without making actual API call
        this.results.push({
          name: 'Firecrawl API Key',
          status: 'warning',
          message: 'Configured (validity not tested)'
        });
      } catch (error) {
        this.results.push({
          name: 'Firecrawl API Key',
          status: 'fail',
          message: 'Failed to initialize client',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async testDatabaseConnection() {
    console.log(chalk.yellow('\n🗄️  Testing Database Connection...'));
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Test basic query
      const { data, error } = await supabase
        .from('agents')
        .select('count')
        .limit(1);

      if (error) throw error;

      this.results.push({
        name: 'Supabase Database',
        status: 'pass',
        message: 'Connected successfully'
      });

      // Test specific tables
      const tables = [
        'agents',
        'agent_tasks',
        'agent_metrics',
        'leads',
        'content_outputs',
        'interviews',
        'resumes'
      ];

      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('count').limit(1);
          this.results.push({
            name: `Table: ${table}`,
            status: error ? 'fail' : 'pass',
            message: error ? `Error: ${error.message}` : 'Accessible',
          });
        } catch (err) {
          this.results.push({
            name: `Table: ${table}`,
            status: 'fail',
            message: 'Failed to access',
            details: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      this.results.push({
        name: 'Supabase Database',
        status: 'fail',
        message: 'Connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testAgentInitialization() {
    console.log(chalk.yellow('\n🤖 Testing AI Agent Initialization...'));
    
    const agents = [
      {
        name: 'EnhancedLeadGenerationAgent',
        path: '../lib/agents/enhanced-lead-generation',
        requiresFirecrawl: true
      },
      {
        name: 'AIContentStudioUltra',
        path: '../lib/agents/ai-content-studio-ultra',
        requiresFirecrawl: true
      },
      {
        name: 'DeepThinkingOrchestrator',
        path: '../lib/agents/deep-thinking-orchestrator',
        requiresFirecrawl: false
      },
      {
        name: 'AIInterviewCenter',
        path: '../lib/agents/ai-interview-center',
        requiresFirecrawl: true
      },
      {
        name: 'ResumeParserPipeline',
        path: '../lib/agents/resume-parser-pipeline',
        requiresFirecrawl: false
      }
    ];

    for (const agent of agents) {
      try {
        const module = await import(agent.path);
        const AgentClass = module[agent.name];
        
        if (!AgentClass) {
          throw new Error(`Agent class ${agent.name} not found in module`);
        }

        // Test initialization
        const testUserId = 'test-user-123';
        let instance;
        
        if (agent.requiresFirecrawl) {
          instance = new AgentClass(
            process.env.GEMINI_API_KEY || '',
            process.env.NEXT_PUBLIC_FIRECRAWL_API_KEY || '',
            testUserId
          );
        } else {
          instance = new AgentClass(
            process.env.GEMINI_API_KEY || '',
            testUserId
          );
        }

        this.results.push({
          name: `Agent: ${agent.name}`,
          status: 'pass',
          message: 'Initialized successfully'
        });
      } catch (error) {
        this.results.push({
          name: `Agent: ${agent.name}`,
          status: 'fail',
          message: 'Failed to initialize',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async testExternalAPIs() {
    console.log(chalk.yellow('\n🌐 Testing External API Connectivity...'));
    
    // Test Zoho CRM
    if (process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET) {
      this.results.push({
        name: 'Zoho CRM Integration',
        status: 'warning',
        message: 'Configured (OAuth flow required for full test)'
      });
    } else {
      this.results.push({
        name: 'Zoho CRM Integration',
        status: 'fail',
        message: 'Missing configuration'
      });
    }

    // Test Microsoft Entra ID
    if (process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET) {
      this.results.push({
        name: 'Microsoft Entra ID',
        status: 'pass',
        message: 'Configured'
      });
    } else {
      this.results.push({
        name: 'Microsoft Entra ID',
        status: 'fail',
        message: 'Missing configuration'
      });
    }
  }

  private async testEdgeFunctions() {
    console.log(chalk.yellow('\n⚡ Testing Edge Functions...'));
    
    const edgeFunctions = [
      'ai-agents',
      'process-document',
      'rag-query',
      'realtime-stream',
      'websocket-handler'
    ];

    // Note: Can't test Edge Functions directly without deployment
    for (const func of edgeFunctions) {
      this.results.push({
        name: `Edge Function: ${func}`,
        status: 'warning',
        message: 'Defined (runtime test requires deployment)'
      });
    }
  }

  private displayResults() {
    console.log(chalk.blue.bold('\n📊 Test Results Summary\n'));
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;
    
    for (const result of this.results) {
      const icon = result.status === 'pass' ? '✅' : 
                   result.status === 'fail' ? '❌' : '⚠️';
      const color = result.status === 'pass' ? chalk.green :
                    result.status === 'fail' ? chalk.red : chalk.yellow;
      
      console.log(`${icon} ${color(result.name)}: ${result.message}`);
      if (result.details) {
        console.log(`   ${chalk.gray(result.details)}`);
      }
    }
    
    console.log(chalk.blue.bold('\n📈 Summary:'));
    console.log(chalk.green(`   ✅ Passed: ${passed}`));
    console.log(chalk.red(`   ❌ Failed: ${failed}`));
    console.log(chalk.yellow(`   ⚠️  Warnings: ${warnings}`));
    console.log(chalk.blue(`   📊 Total: ${this.results.length}`));
    
    if (failed > 0) {
      console.log(chalk.red.bold('\n❗ Some tests failed. Please check the configuration.'));
      process.exit(1);
    } else if (warnings > 0) {
      console.log(chalk.yellow.bold('\n⚠️  Some warnings detected. Manual verification may be needed.'));
    } else {
      console.log(chalk.green.bold('\n✨ All tests passed! The system is properly configured.'));
    }
  }
}

// Run tests
const tester = new IntegrationTester();
tester.runAllTests().catch(error => {
  console.error(chalk.red.bold('\n💥 Fatal error during testing:'), error);
  process.exit(1);
});