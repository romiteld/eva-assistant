#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-run

/**
 * Deploy All Edge Functions Script
 * Deploys all 12 Edge Functions and runs comprehensive tests
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Configuration
const DEPLOYMENT_CONFIG = {
  supabaseUrl: Deno.env.get('SUPABASE_URL') || 'http://localhost:54321',
  supabaseServiceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  projectId: 'ztakznzshlvqobzbuewb',
}

// Edge Functions to deploy
const EDGE_FUNCTIONS = [
  'agent-orchestrator',
  'ai-agents',
  'gemini-websocket',
  'process-document',
  'queue-processor',
  'rag-query',
  'realtime-stream',
  'setup-storage',
  'twilio-ivr',
  'twilio-webhook',
  'websocket-handler',
  'websocket-relay',
]

// Deployment result interface
interface DeploymentResult {
  functionName: string
  status: 'success' | 'failed' | 'error'
  message: string
  duration: number
  version?: string
}

class EdgeFunctionDeployer {
  private supabase: any
  private results: DeploymentResult[] = []

  constructor() {
    this.supabase = createClient(DEPLOYMENT_CONFIG.supabaseUrl, DEPLOYMENT_CONFIG.supabaseServiceKey)
  }

  async deployAllFunctions(): Promise<void> {
    console.log('🚀 Deploying All Edge Functions')
    console.log('=' .repeat(60))
    
    // Check if Supabase CLI is available
    await this.checkSupabaseCLI()
    
    // Deploy each function
    for (const functionName of EDGE_FUNCTIONS) {
      await this.deployFunction(functionName)
    }
    
    // Show deployment summary
    this.showDeploymentSummary()
    
    // Run tests after deployment
    console.log('\n🧪 Running post-deployment tests...')
    await this.runPostDeploymentTests()
  }

  private async checkSupabaseCLI(): Promise<void> {
    try {
      const process = new Deno.Command('supabase', {
        args: ['--version'],
        stdout: 'piped',
        stderr: 'piped',
      })
      
      const { success, stdout } = await process.output()
      
      if (success) {
        const version = new TextDecoder().decode(stdout)
        console.log(`✅ Supabase CLI: ${version.trim()}`)
      } else {
        throw new Error('Supabase CLI not found')
      }
    } catch (error) {
      console.error('❌ Supabase CLI check failed:', error.message)
      throw error
    }
  }

  private async deployFunction(functionName: string): Promise<void> {
    console.log(`\n📦 Deploying ${functionName}`)
    console.log('-' .repeat(40))
    
    const startTime = Date.now()
    
    try {
      // Check if function directory exists
      const functionDir = `./supabase/functions/${functionName}`
      try {
        await Deno.stat(functionDir)
      } catch {
        throw new Error(`Function directory not found: ${functionDir}`)
      }
      
      // Deploy using Supabase CLI
      const process = new Deno.Command('supabase', {
        args: ['functions', 'deploy', functionName, '--project-ref', DEPLOYMENT_CONFIG.projectId],
        stdout: 'piped',
        stderr: 'piped',
      })
      
      const { success, stdout, stderr } = await process.output()
      const duration = Date.now() - startTime
      
      if (success) {
        const output = new TextDecoder().decode(stdout)
        console.log('✅ Deployment successful')
        console.log(`   Duration: ${duration}ms`)
        
        // Extract version from output if available
        const versionMatch = output.match(/version: (\w+)/)
        const version = versionMatch ? versionMatch[1] : 'unknown'
        
        this.results.push({
          functionName,
          status: 'success',
          message: 'Deployed successfully',
          duration,
          version,
        })
      } else {
        const errorOutput = new TextDecoder().decode(stderr)
        console.log('❌ Deployment failed')
        console.log(`   Error: ${errorOutput}`)
        
        this.results.push({
          functionName,
          status: 'failed',
          message: errorOutput,
          duration,
        })
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.log('❌ Deployment error')
      console.log(`   Error: ${error.message}`)
      
      this.results.push({
        functionName,
        status: 'error',
        message: error.message,
        duration,
      })
    }
  }

  private showDeploymentSummary(): void {
    console.log('\n📊 Deployment Summary')
    console.log('=' .repeat(60))
    
    const successful = this.results.filter(r => r.status === 'success').length
    const failed = this.results.filter(r => r.status === 'failed').length
    const errors = this.results.filter(r => r.status === 'error').length
    
    console.log(`✅ Successful: ${successful}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⚠️  Errors: ${errors}`)
    
    if (failed > 0 || errors > 0) {
      console.log('\n🔍 Failed/Error Details:')
      this.results
        .filter(r => r.status !== 'success')
        .forEach(r => {
          console.log(`   ${r.functionName}: ${r.message}`)
        })
    }
  }

  private async runPostDeploymentTests(): Promise<void> {
    try {
      // Run the test runner
      const process = new Deno.Command('deno', {
        args: ['run', '--allow-net', '--allow-env', '--allow-read', './supabase/functions/test-runner.ts'],
        stdout: 'piped',
        stderr: 'piped',
      })
      
      const { success, stdout, stderr } = await process.output()
      
      if (success) {
        const output = new TextDecoder().decode(stdout)
        console.log(output)
      } else {
        const error = new TextDecoder().decode(stderr)
        console.error('❌ Test runner failed:', error)
      }
    } catch (error) {
      console.error('❌ Failed to run tests:', error.message)
    }
  }

  async checkFunctionHealth(): Promise<void> {
    console.log('\n🔍 Checking Function Health')
    console.log('=' .repeat(60))
    
    for (const functionName of EDGE_FUNCTIONS) {
      try {
        const response = await fetch(`${DEPLOYMENT_CONFIG.supabaseUrl}/functions/v1/${functionName}`, {
          method: 'OPTIONS',
          headers: {
            'Authorization': `Bearer ${DEPLOYMENT_CONFIG.supabaseServiceKey}`,
          },
        })
        
        const status = response.ok ? '✅ Healthy' : '❌ Unhealthy'
        console.log(`${status} ${functionName} (${response.status})`)
      } catch (error) {
        console.log(`❌ Error ${functionName}: ${error.message}`)
      }
    }
  }

  async listDeployedFunctions(): Promise<void> {
    console.log('\n📋 Deployed Functions')
    console.log('=' .repeat(60))
    
    try {
      const process = new Deno.Command('supabase', {
        args: ['functions', 'list', '--project-ref', DEPLOYMENT_CONFIG.projectId],
        stdout: 'piped',
        stderr: 'piped',
      })
      
      const { success, stdout } = await process.output()
      
      if (success) {
        const output = new TextDecoder().decode(stdout)
        console.log(output)
      } else {
        console.log('❌ Failed to list functions')
      }
    } catch (error) {
      console.log('❌ Error listing functions:', error.message)
    }
  }
}

// Main execution
if (import.meta.main) {
  const deployer = new EdgeFunctionDeployer()
  
  try {
    await deployer.deployAllFunctions()
    await deployer.checkFunctionHealth()
    await deployer.listDeployedFunctions()
    
    console.log('\n🎉 Deployment process completed!')
  } catch (error) {
    console.error('❌ Deployment process failed:', error)
    Deno.exit(1)
  }
}