# E2E Test Suite

Comprehensive end-to-end testing for LLM Council covering backend, frontend, and full-stack integration.

## Test Structure

```
tests/e2e/
├── backend/          # Backend API tests (pytest)
│   ├── conftest.py   # Fixtures and test setup
│   ├── test_auth.py
│   ├── test_conversations.py
│   ├── test_messaging.py
│   ├── test_encryption.py
│   └── test_forum.py
├── integration/      # Full-stack integration tests (pytest + Playwright)
│   ├── conftest.py
│   ├── test_full_message_flow.py
│   ├── test_sse_updates.py
│   ├── test_token_refresh.py
│   └── test_edit_retry.py
└── mocks/
    └── openrouter_mock.py  # Mock LLM API responses
```

```
frontend/tests/e2e/   # Frontend UI tests (Playwright)
├── fixtures.js       # Shared test utilities
├── auth.spec.js
├── conversation.spec.js
├── navigation.spec.js
├── encryption.spec.js
└── logout.spec.js
```

## Running Tests

### All Tests
```bash
./scripts/run_e2e_tests.sh
```

### Backend Tests Only
```bash
pytest tests/e2e/backend -v
```

### Frontend Tests Only
```bash
cd frontend
npm run test:e2e
```

### Integration Tests Only
```bash
pytest tests/e2e/integration -v
```

### Debug Mode (Playwright)
```bash
cd frontend
npm run test:e2e:debug
```

## Test Coverage

### Backend Tests (5 files, ~30 tests)
- **Auth**: Register, login, token refresh, logout
- **Conversations**: CRUD operations, list filtering
- **Messaging**: SSE streaming, all stages (1, 1.5, 2, 3)
- **Encryption**: Encrypt/decrypt conversations, status checks
- **Forum**: Publish/unpublish, list public conversations

### Frontend Tests (5 files, ~25 tests)
- **Auth**: Register, login, session persistence
- **Conversation**: Create, send messages, view stages
- **Navigation**: Switch conversations, sidebar updates
- **Encryption**: Encrypt/decrypt UI controls
- **Logout**: Clear session, auth state management

### Integration Tests (4 files, ~15 tests)
- **Full Message Flow**: Frontend → Backend → All stages displayed
- **SSE Updates**: Real-time sidebar updates across tabs
- **Token Refresh**: Automatic token rotation, long sessions
- **Edit/Retry**: Message editing, retry logic, cancel

## Key Features

✅ **Mock LLM API**: No real OpenRouter calls, fast execution
✅ **Isolated Data**: Each test uses separate temporary storage
✅ **Success Paths Only**: Focus on happy paths, no fuzzy testing
✅ **Real Browsers**: Tests run in actual Chromium via Playwright
✅ **Full Coverage**: Auth, messaging, encryption, streaming, SSE

## Configuration

### Environment Variables
Tests use `.env.test` for configuration:
- `ENVIRONMENT=local` - Disables production auth requirements
- `JWT_SECRET_KEY` - Test-only secret
- `ENCRYPTION_ENABLED=false` - Faster tests

### Test Data
- Backend: `data_test/` (auto-cleaned)
- Integration: `data_integration_test/` (auto-cleaned)
- Frontend: In-memory via mocked API

## Dependencies

### Python
- `pytest` - Test framework
- `pytest-asyncio` - Async test support
- `pytest-timeout` - Test timeouts
- `playwright` - Browser automation (Python bindings)
- `requests` - HTTP client for API calls

### JavaScript
- `@playwright/test` - Browser automation

Install:
```bash
pip install -e .  # Installs all test dependencies
cd frontend && npm install
```

## CI/CD Integration (Future)

The test suite is designed for CI/CD but not yet integrated:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: ./scripts/run_e2e_tests.sh
  env:
    ENVIRONMENT: local
    JWT_SECRET_KEY: ${{ secrets.TEST_JWT_SECRET }}
```

## Troubleshooting

### Tests fail with "Port already in use"
Kill processes on ports 5173 (frontend) or 8003 (backend):
```bash
lsof -ti:5173 | xargs kill -9
lsof -ti:8003 | xargs kill -9
```

### Playwright browser not installed
```bash
cd frontend
npx playwright install chromium
```

### Tests timeout
- Check backend server starts successfully
- Verify mocked responses return data
- Increase timeouts in test files if needed

## Writing New Tests

### Backend Test Example
```python
def test_new_feature(client, auth_user):
    response = client.get(
        "/api/new-endpoint",
        headers=auth_user["headers"]
    )
    assert response.status_code == 200
```

### Frontend Test Example
```javascript
test('should do something', async ({ authenticatedPage }) => {
  const { page } = authenticatedPage;
  await page.click('button:has-text("Action")');
  await expect(page.locator('.result')).toBeVisible();
});
```

## Test Maintenance

- **Run regularly** to catch regressions
- **Update mocks** when API contracts change
- **Keep tests focused** on single responsibility
- **Use fixtures** for common setup
- **Clean up** test data in teardown

---

Last Updated: 2025-11-29
