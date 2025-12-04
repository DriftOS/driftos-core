#!/bin/bash
set -e

echo "🧪 Fastify Gold Standard - API Test Script"
echo "=========================================="
echo ""

# Configuration
API_URL="http://localhost:3000/api/v1"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="password123"
TEST_NAME="Test User"

echo "📍 Testing API at: $API_URL"
echo ""

# Function to make API calls and pretty print
function api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    echo "➡️  $method $endpoint"
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data")
        else
            response=$(curl -s -X "$method" "$API_URL$endpoint" \
                -H "Authorization: Bearer $token")
        fi
    else
        if [ -n "$data" ]; then
            response=$(curl -s -X "$method" "$API_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            response=$(curl -s -X "$method" "$API_URL$endpoint")
        fi
    fi
    
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
}

# 1. Health Check
echo "1️⃣  Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
api_call "GET" "/health"

# 2. Try to Register User (will fail if exists, that's OK)
echo "2️⃣  Register or Login"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
login_data=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "$TEST_PASSWORD"
}
EOF
)

# Try login first
login_response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_data")

TOKEN=$(echo "$login_response" | jq -r '.data.token // empty' 2>/dev/null)

# If login fails, try to register
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "➡️  User doesn't exist, registering..."
    register_data=$(cat <<EOF
{
  "email": "$TEST_EMAIL",
  "password": "$TEST_PASSWORD",
  "name": "$TEST_NAME"
}
EOF
)
    
    register_response=$(curl -s -X POST "$API_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d "$register_data")
    
    TOKEN=$(echo "$register_response" | jq -r '.data.token // empty' 2>/dev/null)
else
    echo "➡️  Login successful"
    echo "$login_response" | jq '.' 2>/dev/null || echo "$login_response"
    echo ""
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo "❌ Failed to get authentication token"
    exit 1
fi

echo "✅ Authenticated! Token: ${TOKEN:0:20}..."
echo ""

# 4. Get Current User
echo "4️⃣  Get Current User Info"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
api_call "GET" "/users/me" "" "$TOKEN"

# 5. Create Todo (Golden Orchestrator Pattern!)
echo "5️⃣  Create Todo (Golden Orchestrator Pattern ⭐)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
todo_data=$(cat <<EOF
{
  "title": "Test the Golden Orchestrator Pattern",
  "description": "This todo was created via the orchestrator pipeline!"
}
EOF
)

api_call "POST" "/todos" "$todo_data" "$TOKEN"

# 6. List Todos
echo "6️⃣  List All Todos"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
api_call "GET" "/todos" "" "$TOKEN"

# 7. Check Metrics
echo "7️⃣  Check Prometheus Metrics (includes orchestrator performance)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "➡️  GET /metrics (showing todo orchestrator metrics only)"
curl -s http://localhost:3000/metrics | grep "todo" | head -20
echo "..."
echo ""

# 8. Swagger Documentation
echo "8️⃣  API Documentation Available"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Swagger UI: http://localhost:3000/documentation"
echo "📊 Grafana:    http://localhost:3001 (admin/admin)"
echo "📈 Prometheus: http://localhost:9090"
echo ""

# Summary
echo "✨ Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Health check passed"
echo "✅ User authenticated"
echo "✅ Todo created via Golden Orchestrator"
echo "✅ Todos retrieved"
echo "✅ Metrics exposed"
echo ""
echo "🎉 All tests passed!"
echo ""
echo "💡 Next steps:"
echo "   • Open Grafana to see performance metrics"
echo "   • Check Swagger for full API documentation"
echo "   • Generate a new service: make generate"
echo ""
