#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';
import axios, { AxiosError } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Test Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztakznzshlvqobzbuewb.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0YWt6bnpzaGx2cW9iemJ1ZXdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNzExODcsImV4cCI6MjA2NzY0NzE4N30.KeQ2Y39dubF9lsEt5c81FotvLInwYtRsA9zWGwlPu9s';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Test Results Interface
interface TestResult {
  route: string;
  method: string;
  category: string;
  status: 'success' | 'failure' | 'skipped';
  responseCode?: number;
  responseTime?: number;
  error?: string;
  data?: any;
  notes?: string;
}

// Test Categories
const categories = {
  AUTH: 'Authentication',
  DASHBOARD: 'Dashboard Pages',
  API: 'API Endpoints',
  INTEGRATION: 'External Integrations',
  AI: 'AI Features',
  COMMUNICATION: 'Communication Tools',
  DATA: 'Data Management',
  MONITORING: 'Monitoring & Analytics'
};

class ComprehensiveTestSuite {
  private supabase: any;
  private session: any;
  private results: TestResult[] = [];
  private startTime: Date;
  private authToken: string = '';

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this.startTime = new Date();
  }

  // Helper: Make authenticated request
  private async makeRequest(
    route: string,
    method: string = 'GET',
    data?: any,
    headers?: any
  ): Promise<TestResult> {
    const start = Date.now();
    const result: TestResult = {
      route,
      method,
      category: this.categorizeRoute(route),
      status: 'failure'
    };

    try {
      const config: any = {
        method,
        url: `${BASE_URL}${route}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
          ...headers
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      result.status = 'success';
      result.responseCode = response.status;
      result.responseTime = Date.now() - start;
      result.data = response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      result.error = axiosError.message;
      result.responseCode = axiosError.response?.status;
      result.responseTime = Date.now() - start;
      if (axiosError.response?.data) {
        result.data = axiosError.response.data;
      }
    }

    this.results.push(result);
    return result;
  }

  // Categorize routes
  private categorizeRoute(route: string): string {
    if (route.includes('/auth')) return categories.AUTH;
    if (route.includes('/dashboard')) return categories.DASHBOARD;
    if (route.includes('/api/zoho') || route.includes('/api/linkedin') || 
        route.includes('/api/microsoft') || route.includes('/api/twilio') ||
        route.includes('/api/zoom')) return categories.INTEGRATION;
    if (route.includes('/api/gemini') || route.includes('/api/agents') ||
        route.includes('/api/chat') || route.includes('/firecrawl')) return categories.AI;
    if (route.includes('/api/email') || route.includes('/api/sms') ||
        route.includes('/api/voice')) return categories.COMMUNICATION;
    if (route.includes('/api/tasks') || route.includes('/api/deals') ||
        route.includes('/api/recruiters')) return categories.DATA;
    if (route.includes('/monitoring') || route.includes('/analytics') ||
        route.includes('/metrics')) return categories.MONITORING;
    return categories.API;
  }

  // Test Authentication
  async testAuthentication(): Promise<void> {
    console.log('🔐 Testing Authentication...');
    
    // Test login with test account
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: 'danny.romitelli@gmail.com',
      password: 'TestPassword123!' // You'll need to set this up
    });

    if (error) {
      console.log('⚠️  Using anonymous session for testing');
      // Create anonymous session for testing
      const { data: anonData } = await this.supabase.auth.getSession();
      this.session = anonData?.session;
    } else {
      this.session = data.session;
      this.authToken = data.session?.access_token || '';
    }

    // Test auth endpoints
    await this.makeRequest('/api/auth-status');
    await this.makeRequest('/api/verify-session');
    await this.makeRequest('/api/test-session');
  }

  // Test Dashboard Pages
  async testDashboardPages(): Promise<void> {
    console.log('📊 Testing Dashboard Pages...');
    
    const dashboardPages = [
      '/dashboard',
      '/dashboard/analytics',
      '/dashboard/calls',
      '/dashboard/competitor-analysis',
      '/dashboard/content-studio',
      '/dashboard/deals',
      '/dashboard/documents',
      '/dashboard/email-templates',
      '/dashboard/eva-voice',
      '/dashboard/files',
      '/dashboard/firecrawl',
      '/dashboard/lead-generation',
      '/dashboard/linkedin',
      '/dashboard/messages',
      '/dashboard/monitoring',
      '/dashboard/orchestrator',
      '/dashboard/outreach',
      '/dashboard/performance',
      '/dashboard/post-predictor',
      '/dashboard/recruiter-intel',
      '/dashboard/settings',
      '/dashboard/sharepoint',
      '/dashboard/tasks',
      '/dashboard/teams',
      '/dashboard/twilio',
      '/dashboard/workflows',
      '/dashboard/zoho',
      '/dashboard/zoom'
    ];

    for (const page of dashboardPages) {
      await this.makeRequest(page);
    }
  }

  // Test API Endpoints
  async testAPIEndpoints(): Promise<void> {
    console.log('🔌 Testing API Endpoints...');
    
    // Health & Status
    await this.makeRequest('/api/health');
    await this.makeRequest('/api/health/database');
    
    // Tasks API
    await this.makeRequest('/api/tasks');
    await this.makeRequest('/api/tasks', 'POST', {
      title: 'Test Task',
      description: 'Automated test task',
      status: 'todo'
    });
    
    // Recruiters API
    await this.makeRequest('/api/recruiters');
    await this.makeRequest('/api/recruiters/metrics');
    await this.makeRequest('/api/recruiters/insights');
    
    // Deals API
    await this.makeRequest('/api/deals/metrics');
    
    // Email Templates
    await this.makeRequest('/api/email-templates');
    
    // Chat API
    await this.makeRequest('/api/chat', 'POST', {
      message: 'Test message'
    });
  }

  // Test Integrations
  async testIntegrations(): Promise<void> {
    console.log('🔗 Testing Integrations...');
    
    // Zoho Integration
    await this.makeRequest('/api/zoho/queue');
    
    // LinkedIn Integration
    await this.makeRequest('/api/linkedin/token');
    await this.makeRequest('/api/linkedin/stats');
    
    // Microsoft Integration
    await this.makeRequest('/api/microsoft/calendar');
    await this.makeRequest('/api/microsoft/teams');
    await this.makeRequest('/api/auth/microsoft/check-config');
    
    // Twilio Integration
    await this.makeRequest('/api/twilio/status');
    await this.makeRequest('/api/twilio/config');
    
    // Zoom Integration
    await this.makeRequest('/api/zoom/auth/status');
    await this.makeRequest('/api/zoom/user');
  }

  // Test AI Features
  async testAIFeatures(): Promise<void> {
    console.log('🤖 Testing AI Features...');
    
    // Gemini API
    await this.makeRequest('/api/gemini', 'POST', {
      prompt: 'Test prompt'
    });
    
    // Agents API
    await this.makeRequest('/api/agents');
    await this.makeRequest('/api/agents/stats');
    await this.makeRequest('/api/agents/workflows');
    
    // Firecrawl API
    await this.makeRequest('/api/firecrawl/scrape', 'POST', {
      url: 'https://example.com'
    });
  }

  // Test WebSocket Connections
  async testWebSockets(): Promise<void> {
    console.log('🔌 Testing WebSocket Connections...');
    
    await this.makeRequest('/api/socket');
    await this.makeRequest('/api/firecrawl/websocket');
    await this.makeRequest('/api/twilio/sync/websocket');
  }

  // Generate Comprehensive Report
  generateReport(): void {
    const endTime = new Date();
    const duration = (endTime.getTime() - this.startTime.getTime()) / 1000;
    
    const report = {
      summary: {
        totalTests: this.results.length,
        successful: this.results.filter(r => r.status === 'success').length,
        failed: this.results.filter(r => r.status === 'failure').length,
        skipped: this.results.filter(r => r.status === 'skipped').length,
        duration: `${duration}s`,
        timestamp: new Date().toISOString()
      },
      categorySummary: this.getCategorySummary(),
      detailedResults: this.results,
      criticalIssues: this.getCriticalIssues(),
      recommendations: this.getRecommendations()
    };

    // Save detailed report
    const reportPath = path.join(__dirname, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate markdown report
    this.generateMarkdownReport(report);
    
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }

  private getCategorySummary(): any {
    const summary: any = {};
    
    Object.values(categories).forEach(category => {
      const categoryResults = this.results.filter(r => r.category === category);
      summary[category] = {
        total: categoryResults.length,
        successful: categoryResults.filter(r => r.status === 'success').length,
        failed: categoryResults.filter(r => r.status === 'failure').length,
        avgResponseTime: this.calculateAvgResponseTime(categoryResults)
      };
    });
    
    return summary;
  }

  private calculateAvgResponseTime(results: TestResult[]): number {
    const times = results.filter(r => r.responseTime).map(r => r.responseTime!);
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private getCriticalIssues(): any[] {
    return this.results
      .filter(r => r.status === 'failure' && r.responseCode === 500)
      .map(r => ({
        route: r.route,
        error: r.error,
        category: r.category
      }));
  }

  private getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check for authentication issues
    const authFailures = this.results.filter(r => 
      r.category === categories.AUTH && r.status === 'failure'
    );
    if (authFailures.length > 0) {
      recommendations.push('⚠️  Authentication system needs attention - multiple auth endpoints failing');
    }
    
    // Check for integration issues
    const integrationFailures = this.results.filter(r => 
      r.category === categories.INTEGRATION && r.status === 'failure'
    );
    if (integrationFailures.length > 0) {
      recommendations.push('🔗 External integrations need configuration - check API keys and credentials');
    }
    
    // Check response times
    const slowEndpoints = this.results.filter(r => 
      r.responseTime && r.responseTime > 3000
    );
    if (slowEndpoints.length > 0) {
      recommendations.push('🐌 Some endpoints are slow (>3s) - consider optimization');
    }
    
    return recommendations;
  }

  private generateMarkdownReport(report: any): void {
    let markdown = `# EVA Assistant Comprehensive Test Report

## 📊 Summary
- **Total Tests**: ${report.summary.totalTests}
- **Successful**: ${report.summary.successful} ✅
- **Failed**: ${report.summary.failed} ❌
- **Skipped**: ${report.summary.skipped} ⏭️
- **Duration**: ${report.summary.duration}
- **Timestamp**: ${report.summary.timestamp}

## 📈 Category Summary
`;

    Object.entries(report.categorySummary).forEach(([category, stats]: [string, any]) => {
      const successRate = ((stats.successful / stats.total) * 100).toFixed(1);
      markdown += `\n### ${category}
- Total: ${stats.total}
- Success Rate: ${successRate}%
- Avg Response Time: ${stats.avgResponseTime.toFixed(0)}ms
`;
    });

    markdown += `\n## 🚨 Critical Issues\n`;
    if (report.criticalIssues.length === 0) {
      markdown += `No critical issues found! 🎉\n`;
    } else {
      report.criticalIssues.forEach((issue: any) => {
        markdown += `- **${issue.route}** (${issue.category}): ${issue.error}\n`;
      });
    }

    markdown += `\n## 💡 Recommendations\n`;
    report.recommendations.forEach((rec: string) => {
      markdown += `- ${rec}\n`;
    });

    markdown += `\n## 📋 Detailed Results\n`;
    markdown += `| Route | Method | Category | Status | Response Code | Response Time |\n`;
    markdown += `|-------|--------|----------|--------|---------------|---------------|\n`;
    
    report.detailedResults.forEach((result: TestResult) => {
      const status = result.status === 'success' ? '✅' : '❌';
      markdown += `| ${result.route} | ${result.method} | ${result.category} | ${status} | ${result.responseCode || 'N/A'} | ${result.responseTime ? result.responseTime + 'ms' : 'N/A'} |\n`;
    });

    const mdPath = path.join(__dirname, `test-report-${Date.now()}.md`);
    fs.writeFileSync(mdPath, markdown);
    console.log(`📝 Markdown report saved to: ${mdPath}`);
  }

  // Run all tests
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite...\n');
    
    try {
      await this.testAuthentication();
      await this.testDashboardPages();
      await this.testAPIEndpoints();
      await this.testIntegrations();
      await this.testAIFeatures();
      await this.testWebSockets();
    } catch (error) {
      console.error('❌ Test suite encountered an error:', error);
    } finally {
      this.generateReport();
    }
  }
}

// Run the test suite
const suite = new ComprehensiveTestSuite();
suite.runAllTests().catch(console.error);