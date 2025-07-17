import { APIIntegrationTester } from './api-integration-tester';
import fs from 'fs/promises';
import path from 'path';

async function runTests() {
  // Configure the tester
  const tester = new APIIntegrationTester({
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    authToken: process.env.TEST_AUTH_TOKEN,
    verbose: true,
  });

  try {
    // Run all tests
    await tester.runAllTests();

    // Generate report
    const report = tester.generateReport();

    // Save report to file
    const reportPath = path.join(process.cwd(), 'api-test-report.md');
    await fs.writeFile(reportPath, report);

    console.log(`\nReport saved to: ${reportPath}`);
    console.log('\n--- SUMMARY ---');
    console.log(report.split('## Failed Tests')[0]);
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

export { runTests };