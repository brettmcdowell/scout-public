#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting TerraVision Scout..."

# Server
cd "$SCRIPT_DIR/server"
if [ ! -d ".venv" ]; then
  echo "Creating server venv..."
  uv venv .venv
  uv pip install -r requirements.txt
fi
source .venv/bin/activate
uvicorn main:app --reload &
SERVER_PID=$!

# Client
cd "$SCRIPT_DIR/client"
if [ ! -d "node_modules" ]; then
  echo "Installing client deps..."
  npm install
fi
npm run dev &
CLIENT_PID=$!

echo ""
echo "TerraVision Scout running:"
echo "  Client: http://localhost:5173"
echo "  Server: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop both."

trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null" EXIT
wait
