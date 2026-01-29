#!/bin/bash

# Info Board - Development Runner
# Runs both backend and frontend concurrently

set -e

echo "========================================"
echo "       INFO BOARD - Starting Dev       "
echo "========================================"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed"
    echo "Install it with: npm install -g pnpm"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
    echo ""
fi

echo "Starting servers..."
echo ""
echo "  Backend:  http://localhost:3000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "========================================"
echo ""

# Run both services
pnpm dev
