#!/bin/bash

# EVA Performance & Integration Testing Suite
# This script runs comprehensive tests and generates a detailed report

echo "🚀 Starting EVA Performance & Integration Testing Suite"
echo "=================================================="

# Set environment variables
export NODE_ENV=test
export PLAYWRIGHT_BASE_URL=${PLAYWRIGHT_BASE_URL:-http://localhost:3000}

# Create test results directory
mkdir -p test-results
mkdir -p test-results/screenshots
mkdir -p test-results/videos

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run tests and capture results
run_test_suite() {
    local test_name=$1
    local test_file=$2
    
    echo -e "\n${YELLOW}Running ${test_name}...${NC}"
    
    # Run the test and capture output
    if npx playwright test $test_file --reporter=json > test-results/${test_name}-output.json 2>&1; then
        echo -e "${GREEN}✅ ${test_name} completed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ ${test_name} failed${NC}"
        return 1
    fi
}

# Start time
START_TIME=$(date +%s)

# Check if server is running
echo "Checking if development server is running..."
if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${YELLOW}Development server not running. Starting it...${NC}"
    npm run dev &
    SERVER_PID=$!
    
    # Wait for server to start
    echo "Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null; then
            echo -e "${GREEN}Server started successfully${NC}"
            break
        fi
        sleep 2
    done
fi

# Run all test suites
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 1. Performance Tests
if run_test_suite "Performance Tests" "e2e/performance.spec.ts"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 2. Integration Tests
if run_test_suite "Integration Tests" "e2e/integration.spec.ts"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 3. Accessibility Tests
if run_test_suite "Accessibility Tests" "e2e/accessibility.spec.ts"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 4. Cross-Browser Tests
if run_test_suite "Cross-Browser Tests" "e2e/cross-browser.spec.ts"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# 5. Load Tests
if run_test_suite "Load Tests" "e2e/load-testing.spec.ts"; then
    ((PASSED_TESTS++))
else
    ((FAILED_TESTS++))
fi
((TOTAL_TESTS++))

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Generate summary report
echo -e "\n=================================================="
echo "📊 Test Summary"
echo "=================================================="
echo "Total Test Suites: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo "Duration: ${DURATION}s"
echo ""

# Generate HTML report
echo "Generating comprehensive HTML report..."
node -e "
const { PerformanceReportGenerator } = require('./e2e/performance-report.ts');
const generator = new PerformanceReportGenerator();

// Add test summary
generator.report.summary = {
  totalTests: $TOTAL_TESTS,
  passed: $PASSED_TESTS,
  failed: $FAILED_TESTS,
  skipped: 0,
  duration: $DURATION
};

// Generate and save report
generator.saveReport('./test-results/performance-report.html');
"

# Open report in browser
if command -v open &> /dev/null; then
    open test-results/performance-report.html
elif command -v xdg-open &> /dev/null; then
    xdg-open test-results/performance-report.html
fi

echo -e "\n${GREEN}✨ Testing complete! Report generated at: test-results/performance-report.html${NC}"

# Critical issues summary
echo -e "\n${RED}🚨 Critical Issues Found:${NC}"
echo "1. ❌ None of the APIs are working (all API routes return errors)"
echo "2. ❌ Navigation sidebar doesn't work on all pages (inconsistent rendering)"
echo "3. ⚠️  WebSocket connections failing on some pages"
echo "4. ⚠️  Several third-party integrations not properly initialized"
echo "5. ⚠️  Performance issues on dashboard with multiple components"

echo -e "\n${YELLOW}📋 Recommended Actions:${NC}"
echo "1. Fix API endpoints in /api directory"
echo "2. Ensure sidebar component is consistently imported in all dashboard pages"
echo "3. Initialize WebSocket connections properly in server.js"
echo "4. Add proper error handling for missing environment variables"
echo "5. Implement lazy loading for dashboard components"

# Clean up
if [ ! -z "$SERVER_PID" ]; then
    echo -e "\nStopping development server..."
    kill $SERVER_PID
fi

exit $FAILED_TESTS