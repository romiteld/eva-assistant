#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const TEST_MODE = process.env.TEST_MODE || 'comprehensive';
const VERBOSE = process.env.VERBOSE === 'true';

async function runIntegrationTests() {
  console.log('🔍 Running EVA Integration Health Tests');
  console.log('=====================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Mode: ${TEST_MODE}`);
  console.log(`Verbose: ${VERBOSE}\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/test/integration-health?mode=${TEST_MODE}&verbose=${VERBOSE}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Test failed');
    }

    // Print summary
    console.log('📊 Test Summary:');
    console.log(`Total Integrations: ${data.summary.totalIntegrations}`);
    console.log(`Overall Health: ${data.summary.overallHealth.toFixed(1)}%`);
    console.log(`✅ Healthy: ${data.summary.healthy}`);
    console.log(`⚠️  Degraded: ${data.summary.degraded}`);
    console.log(`❌ Failed: ${data.summary.failed}`);
    console.log(`Critical Issues: ${data.summary.criticalIssues}`);
    console.log('');

    // Print integration details
    console.log('📋 Integration Details:');
    for (const result of data.results) {
      const emoji = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
      console.log(`\n${emoji} ${result.integration} - ${result.overallHealth.toFixed(1)}% Health`);
      
      if (VERBOSE) {
        for (const test of result.tests) {
          const testEmoji = test.passed ? '✅' : '❌';
          console.log(`  ${testEmoji} ${test.name}${test.duration ? ` (${test.duration}ms)` : ''}`);
          if (!test.passed && test.error) {
            console.log(`     Error: ${test.error}`);
          }
        }
      }
    }

    // Save full report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(__dirname, `integration-report-${timestamp}.md`);
    fs.writeFileSync(reportPath, data.report);
    console.log(`\n📄 Full report saved to: ${reportPath}`);

    // Exit with appropriate code
    const hasFailures = data.summary.failed > 0;
    process.exit(hasFailures ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
runIntegrationTests();