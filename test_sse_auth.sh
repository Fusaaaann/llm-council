#!/bin/bash

# Test SSE streaming with Authorization header
# This simulates the new fetch()-based approach

echo "Testing SSE stream with Authorization header..."
echo ""

# Start backend if not running
if ! lsof -i:8003 > /dev/null 2>&1; then
    echo "Starting backend..."
    cd /home/user/File-System/Bots/llm-council
    python -m backend.main &
    BACKEND_PID=$!
    sleep 3
fi

# Test with curl (simulating fetch() with Authorization header)
echo "Connecting to /api/conversations/stream with header auth..."
echo ""

curl -N \
  -H "Authorization: Bearer test-token-123" \
  -H "Accept: text/event-stream" \
  "http://localhost:8003/api/conversations/stream?view=private&profile_id=default" \
  2>&1 | head -n 20

echo ""
echo "Test complete!"

# Cleanup
if [ ! -z "$BACKEND_PID" ]; then
    kill $BACKEND_PID 2>/dev/null
fi
