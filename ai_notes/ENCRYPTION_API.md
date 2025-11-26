# Encryption API Documentation

## Overview

The LLM Council application now supports switching individual conversations between encrypted and plaintext storage states via API endpoints and UI controls (currently hidden).

## Backend API Endpoints

### 1. Get Encryption Status
**GET** `/api/conversations/{conversation_id}/encryption-status`

Query params: `profile_id` (optional)

Returns:
```json
{
  "is_encrypted": true,
  "provider": "fernet",
  "version": "1.0"
}
```

### 2. Encrypt Conversation
**POST** `/api/conversations/{conversation_id}/encrypt`

Query params: `profile_id` (optional)

Encrypts a plaintext conversation. If already encrypted, returns success with no changes.

Returns:
```json
{
  "success": true,
  "message": "Conversation encrypted",
  "status": {
    "is_encrypted": true,
    "provider": "fernet",
    "version": "1.0"
  }
}
```

### 3. Decrypt Conversation
**POST** `/api/conversations/{conversation_id}/decrypt`

Query params: `profile_id` (optional)

Decrypts an encrypted conversation to plaintext storage. If already plaintext, returns success with no changes.

Returns:
```json
{
  "success": true,
  "message": "Conversation decrypted",
  "status": {
    "is_encrypted": false,
    "provider": null,
    "version": null
  }
}
```

## Storage Layer Functions

### Python API

```python
from backend.storage import (
    encrypt_conversation,
    decrypt_conversation,
    get_conversation_encryption_status
)

# Encrypt a conversation
conversation = encrypt_conversation(conversation_id, profile_id)

# Decrypt a conversation
conversation = decrypt_conversation(conversation_id, profile_id)

# Check encryption status
status = get_conversation_encryption_status(conversation_id, profile_id)
# Returns: {"is_encrypted": bool, "provider": str|None, "version": str|None}
```

## Frontend Integration

### API Client

```javascript
import { api } from './api';

// Get encryption status
const status = await api.getEncryptionStatus(conversationId);

// Encrypt conversation
const result = await api.encryptConversation(conversationId);

// Decrypt conversation
const result = await api.decryptConversation(conversationId);
```

### React Component

The `EncryptionControls` component provides UI for managing encryption:

```jsx
import EncryptionControls from './components/EncryptionControls';

<EncryptionControls
  conversationId={conversationId}
  isVisible={true}  // Set to false to hide
/>
```

**Component Features:**
- Displays current encryption status
- Shows provider and version for encrypted conversations
- Encrypt/Decrypt buttons with confirmation dialogs
- Loading states during operations
- Error handling and user feedback

## Enabling the UI

The encryption controls are currently **hidden** in the ModelConfig modal. To enable them:

1. Open `/frontend/src/components/ModelConfig.jsx`
2. Change line 9: `const [showEncryption, setShowEncryption] = useState(false);`
3. Set to: `const [showEncryption, setShowEncryption] = useState(true);`

Or add a toggle button to dynamically show/hide:

```jsx
<button onClick={() => setShowEncryption(!showEncryption)}>
  {showEncryption ? 'Hide' : 'Show'} Encryption Settings
</button>
```

## How It Works

### Encryption Process
1. Loads conversation (auto-decrypts if needed)
2. Checks if already encrypted (no-op if true)
3. Extracts messages array
4. Encrypts messages using Fernet (AES-128-CBC)
5. Stores encrypted blob in `messages_encrypted` field
6. Removes plaintext `messages` field
7. Adds `_encryption` metadata (version, provider)
8. Saves to disk

### Decryption Process
1. Loads conversation (auto-decrypts)
2. Checks if encrypted (no-op if false)
3. Removes `_encryption` metadata
4. Removes `messages_encrypted` field
5. Keeps plaintext `messages` array
6. Saves to disk as plaintext JSON

### File Format

**Encrypted:**
```json
{
  "_encryption": {"version": "1.0", "provider": "fernet"},
  "messages_encrypted": "<base64-ciphertext>",
  "id": "...",
  "title": "...",
  "created_at": "..."
}
```

**Plaintext:**
```json
{
  "id": "...",
  "title": "...",
  "created_at": "...",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "stage1": [...], ...}
  ]
}
```

## Security Considerations

1. **What's encrypted:** Only the `messages` array (user/assistant content)
2. **What's NOT encrypted:** All metadata (id, title, timestamps, is_public, etc.)
3. **Key management:** Uses `ENCRYPTION_KEY` from `.env` file
4. **Backward compatibility:** Transparently reads both encrypted and plaintext files
5. **Idempotent operations:** Encrypting an encrypted conversation is safe (no-op)

## Testing

Run the test suite:

```bash
python test_encryption_api.py
```

This validates:
- Creating conversations
- Encrypting conversations
- Reading encrypted conversations
- Decrypting conversations
- Reading decrypted conversations
- Encryption status checks

## Implementation Files

### Backend
- `backend/storage.py` - Core encryption/decryption functions
- `backend/encryption.py` - Encryption provider abstraction
- `backend/main.py` - API endpoint handlers
- `backend/config.py` - Encryption configuration

### Frontend
- `frontend/src/api.js` - API client functions
- `frontend/src/components/EncryptionControls.jsx` - UI component
- `frontend/src/components/EncryptionControls.css` - Component styling
- `frontend/src/components/ModelConfig.jsx` - Integration point (hidden)

### Tests
- `test_encryption_api.py` - Backend encryption workflow test
- `tests/test_encryption.py` - Unit tests for encryption module

## Future Enhancements

1. **Batch operations:** Encrypt/decrypt multiple conversations at once
2. **Key rotation:** Support for re-encrypting with new keys
3. **Asymmetric encryption:** RSA/hybrid encryption support (architecture ready)
4. **Encryption by default:** Option to automatically encrypt all new conversations
5. **Per-conversation keys:** Instead of single global key
6. **UI in Sidebar:** Add encryption indicator icon next to conversations
