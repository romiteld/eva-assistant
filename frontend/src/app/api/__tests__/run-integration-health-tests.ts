#!/usr/bin/env tsx

import { runIntegrationHealthTests } from './integration-health-tester';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🔍 EVA Integration Health Test Suite');
  console.log('====================================\n');

  const testMode = process.argv[2] as 'basic' | 'comprehensive' | 'stress' || 'comprehensive';
  const verbose = process.argv.includes('--verbose');

  console.log(`Test Mode: ${testMode}`);
  console.log(`Verbose: ${verbose}\n`);

  try {
    const { results, report } = await runIntegrationHealthTests({
      testMode,
      verbose,
    });

    // Save report to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(process.cwd(), `integration-health-report-${timestamp}.md`);
    writeFileSync(reportPath, report);

    console.log('\n✅ Test completed successfully!');
    console.log(`📄 Report saved to: ${reportPath}`);

    // Print summary
    console.log('\n📊 Summary:');
    for (const result of results) {
      const emoji = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
      console.log(`${emoji} ${result.integration}: ${result.overallHealth.toFixed(1)}% health`);
    }

    // Exit with appropriate code
    const hasFailures = results.some(r => r.status === 'failed');
    process.exit(hasFailures ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();