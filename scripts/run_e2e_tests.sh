#!/bin/bash
# E2E Test Runner Script
# Runs all E2E tests: backend, frontend, and integration

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=================================================="
echo "LLM Council E2E Test Suite"
echo "=================================================="

# Check if in project root
if [ ! -f "pyproject.toml" ]; then
    echo -e "${RED}Error: Must run from project root${NC}"
    exit 1
fi

# Load test environment
if [ -f ".env.test" ]; then
    export $(cat .env.test | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Loaded .env.test"
else
    echo -e "${YELLOW}⚠${NC} No .env.test found, using defaults"
fi

# Clean previous test data
echo ""
echo "Cleaning test data..."
rm -rf data_test data_integration_test
echo -e "${GREEN}✓${NC} Test data cleaned"

# Run backend tests
echo ""
echo "=================================================="
echo "Running Backend E2E Tests (pytest)"
echo "=================================================="

if pytest tests/e2e/backend -v --tb=short; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
else
    echo -e "${RED}✗ Backend tests failed${NC}"
    exit 1
fi

# Install Playwright if needed
echo ""
echo "Checking Playwright installation..."
cd frontend
if ! npx playwright --version > /dev/null 2>&1; then
    echo "Installing Playwright..."
    npx playwright install chromium
fi
echo -e "${GREEN}✓${NC} Playwright ready"

# Run frontend tests
echo ""
echo "=================================================="
echo "Running Frontend E2E Tests (Playwright)"
echo "=================================================="

# Note: playwright.config.js will start both servers automatically
if npx playwright test --reporter=list; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
    cd ..
    exit 1
fi

cd ..

# Run integration tests
echo ""
echo "=================================================="
echo "Running Integration Tests (pytest + Playwright)"
echo "=================================================="

# Integration tests need both servers running
# They manage their own server startup in conftest.py

if pytest tests/e2e/integration -v --tb=short; then
    echo -e "${GREEN}✓ Integration tests passed${NC}"
else
    echo -e "${RED}✗ Integration tests failed${NC}"
    exit 1
fi

# Summary
echo ""
echo "=================================================="
echo -e "${GREEN}All E2E Tests Passed! ✓${NC}"
echo "=================================================="
echo ""
echo "Test Results:"
echo "  - Backend tests: ✓"
echo "  - Frontend tests: ✓"
echo "  - Integration tests: ✓"
echo ""

# Cleanup
echo "Cleaning up test data..."
rm -rf data_test data_integration_test
echo -e "${GREEN}✓${NC} Cleanup complete"

exit 0
