#!/bin/bash

# EVA Assistant Comprehensive Testing Script
# This script tests all endpoints and pages in the application

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
REPORT_FILE="test-report-$(date +%Y%m%d-%H%M%S).txt"
JSON_REPORT="test-report-$(date +%Y%m%d-%H%M%S).json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Initialize report
echo "EVA Assistant Comprehensive Test Report" > "$REPORT_FILE"
echo "======================================" >> "$REPORT_FILE"
echo "Test Start Time: $(date)" >> "$REPORT_FILE"
echo "Base URL: $BASE_URL" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Initialize JSON report
echo "{" > "$JSON_REPORT"
echo '  "metadata": {' >> "$JSON_REPORT"
echo "    \"timestamp\": \"$(date -Iseconds)\"," >> "$JSON_REPORT"
echo "    \"baseUrl\": \"$BASE_URL\"" >> "$JSON_REPORT"
echo '  },' >> "$JSON_REPORT"
echo '  "results": [' >> "$JSON_REPORT"

# Function to test an endpoint
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local description="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo "[$method] $endpoint" >> "$REPORT_FILE"
    
    # Prepare curl command
    local curl_cmd="curl -s -o /dev/null -w '%{http_code}' -X $method"
    
    # Add data if provided
    if [ -n "$data" ]; then
        curl_cmd="$curl_cmd -H 'Content-Type: application/json' -d '$data'"
    fi
    
    # Add authentication if available
    if [ -n "$AUTH_TOKEN" ]; then
        curl_cmd="$curl_cmd -H 'Authorization: Bearer $AUTH_TOKEN'"
    fi
    
    # Execute request
    local start_time=$(date +%s%N)
    local status_code=$(eval "$curl_cmd '$BASE_URL$endpoint'")
    local end_time=$(date +%s%N)
    local response_time=$((($end_time - $start_time) / 1000000))
    
    # Check result
    if [ "$status_code" = "$expected_status" ] || [ "$status_code" = "200" ] || [ "$status_code" = "201" ] || [ "$status_code" = "204" ]; then
        echo -e "${GREEN}✓ PASS${NC} - Status: $status_code (${response_time}ms)"
        echo "  ✓ PASS - Status: $status_code (${response_time}ms)" >> "$REPORT_FILE"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        local test_status="pass"
    else
        echo -e "${RED}✗ FAIL${NC} - Status: $status_code (Expected: $expected_status)"
        echo "  ✗ FAIL - Status: $status_code (Expected: $expected_status)" >> "$REPORT_FILE"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        local test_status="fail"
    fi
    
    # Add to JSON report
    if [ $TOTAL_TESTS -gt 1 ]; then
        echo "," >> "$JSON_REPORT"
    fi
    echo -n "    {
      \"method\": \"$method\",
      \"endpoint\": \"$endpoint\",
      \"description\": \"$description\",
      \"status\": \"$test_status\",
      \"statusCode\": $status_code,
      \"responseTime\": $response_time
    }" >> "$JSON_REPORT"
    
    echo "" >> "$REPORT_FILE"
}

# Function to test page load
test_page() {
    test_endpoint "GET" "$1" "$2" "" "200"
}

echo "🚀 Starting Comprehensive Test Suite..."
echo ""

# Test Authentication Endpoints
echo -e "${YELLOW}=== Authentication Tests ===${NC}"
test_endpoint "GET" "/api/auth-status" "Auth Status Check"
test_endpoint "GET" "/api/verify-session" "Verify Session"
test_endpoint "GET" "/api/test-session" "Test Session"
test_endpoint "GET" "/api/csrf" "CSRF Token"
test_endpoint "GET" "/api/auth/microsoft/check-config" "Microsoft Auth Config"

# Test Health Endpoints
echo -e "\n${YELLOW}=== Health Check Tests ===${NC}"
test_endpoint "GET" "/api/health" "General Health Check"
test_endpoint "GET" "/api/health/database" "Database Health Check"
test_endpoint "GET" "/api/test/integration-health" "Integration Health"

# Test Dashboard Pages
echo -e "\n${YELLOW}=== Dashboard Page Tests ===${NC}"
test_page "/dashboard" "Main Dashboard"
test_page "/dashboard/analytics" "Analytics Dashboard"
test_page "/dashboard/calls" "Calls Dashboard"
test_page "/dashboard/competitor-analysis" "Competitor Analysis"
test_page "/dashboard/content-studio" "Content Studio"
test_page "/dashboard/deals" "Deals Management"
test_page "/dashboard/documents" "Documents"
test_page "/dashboard/email-templates" "Email Templates"
test_page "/dashboard/eva-voice" "EVA Voice Assistant"
test_page "/dashboard/files" "Files Management"
test_page "/dashboard/firecrawl" "Firecrawl Main"
test_page "/dashboard/lead-generation" "Lead Generation"
test_page "/dashboard/linkedin" "LinkedIn Integration"
test_page "/dashboard/messages" "Messages"
test_page "/dashboard/monitoring" "Monitoring"
test_page "/dashboard/orchestrator" "Agent Orchestrator"
test_page "/dashboard/outreach" "Outreach Campaigns"
test_page "/dashboard/performance" "Performance Metrics"
test_page "/dashboard/post-predictor" "Post Predictor"
test_page "/dashboard/recruiter-intel" "Recruiter Intel"
test_page "/dashboard/settings" "Settings"
test_page "/dashboard/sharepoint" "SharePoint Integration"
test_page "/dashboard/tasks" "Tasks Management"
test_page "/dashboard/teams" "Teams Management"
test_page "/dashboard/twilio" "Twilio Integration"
test_page "/dashboard/workflows" "Workflows"
test_page "/dashboard/zoho" "Zoho Integration"
test_page "/dashboard/zoom" "Zoom Integration"

# Test API Endpoints - Tasks
echo -e "\n${YELLOW}=== Tasks API Tests ===${NC}"
test_endpoint "GET" "/api/tasks" "Get Tasks List"
test_endpoint "POST" "/api/tasks" "Create Task" '{"title":"Test Task","description":"Automated test","status":"todo"}'

# Test API Endpoints - Recruiters
echo -e "\n${YELLOW}=== Recruiters API Tests ===${NC}"
test_endpoint "GET" "/api/recruiters" "Get Recruiters List"
test_endpoint "GET" "/api/recruiters/metrics" "Recruiter Metrics"
test_endpoint "GET" "/api/recruiters/insights" "Recruiter Insights"

# Test API Endpoints - Deals
echo -e "\n${YELLOW}=== Deals API Tests ===${NC}"
test_endpoint "GET" "/api/deals/metrics" "Deal Metrics"
test_endpoint "POST" "/api/deals/quick-create" "Quick Create Deal" '{"title":"Test Deal","amount":1000}'

# Test API Endpoints - Email Templates
echo -e "\n${YELLOW}=== Email Templates API Tests ===${NC}"
test_endpoint "GET" "/api/email-templates" "Get Email Templates"

# Test Integration APIs
echo -e "\n${YELLOW}=== Integration API Tests ===${NC}"

# Zoho
test_endpoint "GET" "/api/zoho/queue" "Zoho Queue Status"

# LinkedIn
test_endpoint "GET" "/api/linkedin/token" "LinkedIn Token Status"
test_endpoint "GET" "/api/linkedin/stats" "LinkedIn Stats"

# Microsoft
test_endpoint "GET" "/api/microsoft/calendar" "Microsoft Calendar"
test_endpoint "GET" "/api/microsoft/teams" "Microsoft Teams"
test_endpoint "GET" "/api/microsoft/contacts" "Microsoft Contacts"

# Twilio
test_endpoint "GET" "/api/twilio/status" "Twilio Status"
test_endpoint "GET" "/api/twilio/config" "Twilio Config"
test_endpoint "GET" "/api/twilio/analytics" "Twilio Analytics"

# Zoom
test_endpoint "GET" "/api/zoom/auth/status" "Zoom Auth Status"
test_endpoint "GET" "/api/zoom/user" "Zoom User Info"
test_endpoint "GET" "/api/zoom/meetings" "Zoom Meetings List"

# Test AI Features
echo -e "\n${YELLOW}=== AI Feature Tests ===${NC}"
test_endpoint "POST" "/api/gemini" "Gemini AI" '{"prompt":"Test prompt"}'
test_endpoint "GET" "/api/agents" "AI Agents List"
test_endpoint "GET" "/api/agents/stats" "AI Agents Stats"
test_endpoint "GET" "/api/agents/workflows" "AI Workflows"
test_endpoint "POST" "/api/chat" "Chat API" '{"message":"Test message"}'

# Test Firecrawl
echo -e "\n${YELLOW}=== Firecrawl Tests ===${NC}"
test_endpoint "POST" "/api/firecrawl/scrape" "Firecrawl Scrape" '{"url":"https://example.com"}'
test_endpoint "POST" "/api/firecrawl/search" "Firecrawl Search" '{"query":"test"}'
test_endpoint "POST" "/api/firecrawl/map" "Firecrawl Map" '{"url":"https://example.com"}'

# Test Monitoring
echo -e "\n${YELLOW}=== Monitoring Tests ===${NC}"
test_endpoint "GET" "/api/monitoring/metrics" "Monitoring Metrics"

# Test WebSocket Endpoints
echo -e "\n${YELLOW}=== WebSocket Tests ===${NC}"
test_endpoint "GET" "/api/socket" "Socket.io Connection"
test_endpoint "GET" "/api/firecrawl/websocket" "Firecrawl WebSocket"
test_endpoint "GET" "/api/twilio/sync/websocket" "Twilio Sync WebSocket"

# Close JSON array
echo "" >> "$JSON_REPORT"
echo "  ]," >> "$JSON_REPORT"

# Generate Summary
echo -e "\n${YELLOW}=== Test Summary ===${NC}"
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"
SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
echo "Success Rate: $SUCCESS_RATE%"

# Add summary to reports
echo "" >> "$REPORT_FILE"
echo "Test Summary" >> "$REPORT_FILE"
echo "============" >> "$REPORT_FILE"
echo "Total Tests: $TOTAL_TESTS" >> "$REPORT_FILE"
echo "Passed: $PASSED_TESTS" >> "$REPORT_FILE"
echo "Failed: $FAILED_TESTS" >> "$REPORT_FILE"
echo "Success Rate: $SUCCESS_RATE%" >> "$REPORT_FILE"
echo "Test End Time: $(date)" >> "$REPORT_FILE"

# Close JSON report
echo '  "summary": {' >> "$JSON_REPORT"
echo "    \"totalTests\": $TOTAL_TESTS," >> "$JSON_REPORT"
echo "    \"passed\": $PASSED_TESTS," >> "$JSON_REPORT"
echo "    \"failed\": $FAILED_TESTS," >> "$JSON_REPORT"
echo "    \"successRate\": $SUCCESS_RATE" >> "$JSON_REPORT"
echo "  }" >> "$JSON_REPORT"
echo "}" >> "$JSON_REPORT"

echo -e "\n${GREEN}✅ Test suite completed!${NC}"
echo "📄 Text report saved to: $REPORT_FILE"
echo "📊 JSON report saved to: $JSON_REPORT"

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi