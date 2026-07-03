#!/bin/bash
# API Endpoint Testing Script for Usage Tracking
# Tests all usage tracking API endpoints

BASE_URL="${BASE_URL:-http://localhost:3000}"
TEST_AGENT_EMAIL="${TEST_AGENT_EMAIL:-test-agent@aoglobelife.com}"
TEST_SESSION_ID="test-session-$(date +%s)"

echo "=========================================="
echo "Usage Tracking API Test Suite"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Test Agent: $TEST_AGENT_EMAIL"
echo "Session ID: $TEST_SESSION_ID"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo "🧪 Testing: $name"
    echo "   $method $endpoint"
    
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    else
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ PASSED${NC} (HTTP $http_code)"
        echo "   Response: $body"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAILED${NC} (HTTP $http_code)"
        echo "   Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "=========================================="
echo "1. VDP Available Start"
echo "=========================================="
test_endpoint "VDP Available Start" "POST" "/api/usage/vdp-available-start" \
    "{\"agentEmail\":\"$TEST_AGENT_EMAIL\",\"sessionId\":\"$TEST_SESSION_ID\"}"

sleep 2

echo ""
echo "=========================================="
echo "2. VDP Available End"
echo "=========================================="
test_endpoint "VDP Available End" "POST" "/api/usage/vdp-available-end" \
    "{\"agentEmail\":\"$TEST_AGENT_EMAIL\",\"sessionId\":\"$TEST_SESSION_ID\"}"

echo ""
echo "=========================================="
echo "3. Call Connector Pro Call Start"
echo "=========================================="
CALL_ID="test-call-$(date +%s)"
test_endpoint "CCPro Call Start" "POST" "/api/usage/ccpro-call-start" \
    "{\"agentEmail\":\"$TEST_AGENT_EMAIL\",\"sessionId\":\"$TEST_SESSION_ID\",\"callId\":\"$CALL_ID\"}"

sleep 2

echo ""
echo "=========================================="
echo "4. Call Connector Pro Call End"
echo "=========================================="
test_endpoint "CCPro Call End" "POST" "/api/usage/ccpro-call-end" \
    "{\"agentEmail\":\"$TEST_AGENT_EMAIL\",\"sessionId\":\"$TEST_SESSION_ID\",\"callId\":\"$CALL_ID\",\"duration\":300}"

echo ""
echo "=========================================="
echo "5. Get Weekly Stats"
echo "=========================================="
test_endpoint "Get Weekly Stats" "GET" "/api/usage/weekly-stats/$TEST_AGENT_EMAIL"

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All API tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some API tests failed${NC}"
    exit 1
fi
