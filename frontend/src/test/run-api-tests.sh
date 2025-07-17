#!/bin/bash

# API Endpoint Validation Script for EVA Platform
# This script tests all API endpoints for proper authentication and functionality

BASE_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
RESULTS_FILE="api-test-results.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting EVA API Endpoint Validation..."
echo "Testing against: $BASE_URL"
echo "Results will be saved to: $RESULTS_FILE"
echo ""

# Clear previous results
> $RESULTS_FILE

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local method=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing $method $endpoint... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (${http_code})"
        echo "✓ $method $endpoint - $description (Status: $http_code)" >> $RESULTS_FILE
    else
        echo -e "${RED}✗${NC} (Expected: $expected_status, Got: $http_code)"
        echo "✗ $method $endpoint - $description (Expected: $expected_status, Got: $http_code)" >> $RESULTS_FILE
        echo "  Response: $body" >> $RESULTS_FILE
    fi
}

echo "=== Testing Authentication Endpoints ===" | tee -a $RESULTS_FILE
echo ""

test_endpoint "/api/auth-status" "GET" "" "200" "Auth status check"
test_endpoint "/api/auth/test-login" "GET" "" "302" "Test login redirect"
test_endpoint "/api/auth/signout" "POST" "" "200" "Sign out"
test_endpoint "/api/csrf" "GET" "" "200" "CSRF token"
test_endpoint "/api/health" "GET" "" "200" "Health check"
test_endpoint "/api/health/database" "GET" "" "200" "Database health"

echo ""
echo "=== Testing Protected Endpoints (Should Return 401) ===" | tee -a $RESULTS_FILE
echo ""

# Agent Management
test_endpoint "/api/agents" "GET" "" "401" "List agents (protected)"
test_endpoint "/api/agents" "POST" '{"action":"test"}' "401" "Execute agent (protected)"
test_endpoint "/api/agents/monitor" "GET" "" "401" "Monitor agents (protected)"
test_endpoint "/api/agents/stats" "GET" "" "401" "Agent stats (protected)"
test_endpoint "/api/agents/workflows" "GET" "" "401" "Agent workflows (protected)"

# Business Logic
test_endpoint "/api/deals/metrics" "GET" "" "401" "Deal metrics (protected)"
test_endpoint "/api/deals/quick-create" "POST" '{"title":"Test"}' "401" "Quick create deal (protected)"

# Integrations
test_endpoint "/api/microsoft/emails" "GET" "" "401" "Microsoft emails (protected)"
test_endpoint "/api/microsoft/calendar" "GET" "" "401" "Microsoft calendar (protected)"
test_endpoint "/api/microsoft/contacts" "GET" "" "401" "Microsoft contacts (protected)"
test_endpoint "/api/zoom/meetings" "GET" "" "401" "Zoom meetings (protected)"
test_endpoint "/api/twilio/status" "GET" "" "401" "Twilio status (protected)"
test_endpoint "/api/zoho/queue" "GET" "" "401" "Zoho queue (protected)"

# AI/Chat
test_endpoint "/api/chat" "POST" '{"messages":[{"role":"user","content":"Hello"}]}' "401" "Chat (protected)"
test_endpoint "/api/gemini" "POST" '{"prompt":"Test"}' "401" "Gemini (protected)"

# Firecrawl
test_endpoint "/api/firecrawl" "GET" "" "401" "Firecrawl status (protected)"
test_endpoint "/api/firecrawl/scrape" "POST" '{"url":"https://example.com"}' "401" "Firecrawl scrape (protected)"

echo ""
echo "=== Testing Webhook Endpoints ===" | tee -a $RESULTS_FILE
echo ""

# These may return various status codes depending on validation
test_endpoint "/api/webhooks/zoom" "POST" '{"event":"test"}' "200" "Zoom webhook"
test_endpoint "/api/webhooks/email" "POST" '{"event":"test"}' "200" "Email webhook"
test_endpoint "/api/twilio/webhooks/sms" "POST" '{"From":"+1234567890","Body":"Test"}' "200" "Twilio SMS webhook"

echo ""
echo "=== Testing Rate Limiting ===" | tee -a $RESULTS_FILE
echo ""

echo -n "Testing rate limiting on /api/auth-status... "
for i in {1..15}; do
    response=$(curl -s -w "%{http_code}" -o /dev/null "$BASE_URL/api/auth-status" 2>/dev/null)
    if [ "$response" == "429" ]; then
        echo -e "${GREEN}✓${NC} Rate limit enforced after $i requests"
        echo "✓ Rate limiting works - enforced after $i requests" >> $RESULTS_FILE
        break
    fi
done

echo ""
echo "=== Summary ===" | tee -a $RESULTS_FILE
echo ""

total_tests=$(grep -c "^[✓✗]" $RESULTS_FILE)
passed_tests=$(grep -c "^✓" $RESULTS_FILE)
failed_tests=$(grep -c "^✗" $RESULTS_FILE)

echo "Total tests: $total_tests" | tee -a $RESULTS_FILE
echo "Passed: $passed_tests" | tee -a $RESULTS_FILE
echo "Failed: $failed_tests" | tee -a $RESULTS_FILE

echo ""
echo "Detailed results saved to: $RESULTS_FILE"