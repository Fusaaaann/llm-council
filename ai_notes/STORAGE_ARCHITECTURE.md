# Storage Architecture

Complete implementation details for the storage system in LLM Council, including encryption, multi-tenancy, and data flow.

## Overview

Backend-first JSON storage with encryption support, profile-based multi-tenancy, and public/private conversation model.

## Current Implementation: Backend-First

### Data Flow
```
User Action → API Call → Backend → Storage → Response → UI Update
```

### Storage Structure

**Directory Layout:**
```
data/
├── conversations/
│   ├── profile_default/
│   │   ├── <conversation_id_1>.json
│   │   └── <conversation_id_2>.json
│   └── profile_<user_id>/
│       └── <conversation_id_3>.json
├── profiles.json
├── users.json (encrypted)
├── sessions.json (encrypted)
├── invites.json (encrypted)
├── waitlist.json
└── audit.log
```

### Benefits
- Centralized data management
- Easy backup and migration
- Consistent across all devices
- No browser storage limits

## Conversation Storage (`storage.py`)

### Conversation Schema

**Unencrypted Format:**
```json
{
  "id": "abc-123-def",
  "profile_id": "default",
  "created_at": "2025-11-29T10:00:00Z",
  "modified_at": "2025-11-29T10:05:00Z",
  "title": "What is quantum computing?",
  "is_public": false,
  "published_at": null,
  "sync_status": "synced",
  "uses_byok": false,
  "messages": [
    {
      "role": "user",
      "content": "What is quantum computing?"
    },
    {
      "role": "assistant",
      "stage1": [
        {"model": "openai/gpt-5.1", "response": "..."}
      ],
      "stage1_5": {
        "questions": [...],
        "answers": [...],
        "label_to_model": {"Response A": "openai/gpt-5.1"}
      },
      "stage2": [
        {"model": "openai/gpt-5.1", "ranking": "...", "parsed_ranking": ["Response B", "Response A"]}
      ],
      "stage3": {
        "model": "google/gemini-3-pro",
        "response": "..."
      },
      "metadata": {
        "label_to_model": {"Response A": "openai/gpt-5.1"},
        "aggregate_rankings": [
          {"model": "openai/gpt-5.1", "average_rank": 1.5, "rankings_count": 3}
        ]
      }
    }
  ]
}
```

**Encrypted Format:**
```json
{
  "_encryption": {
    "version": "1.0",
    "provider": "fernet"
  },
  "messages_encrypted": "<base64-ciphertext>",
  "id": "abc-123-def",
  "profile_id": "default",
  "created_at": "2025-11-29T10:00:00Z",
  "modified_at": "2025-11-29T10:05:00Z",
  "title": "What is quantum computing?",
  "is_public": false,
  "published_at": null,
  "sync_status": "synced",
  "uses_byok": false
}
```

### Key Features

#### Modified Timestamps
- `created_at`: Timestamp when conversation was created
- `modified_at`: Timestamp when conversation was last modified
- Used for change detection in SSE conversation list updates

#### View Filtering
`list_conversations(view)` supports three views:
- `private`: Only unpublished conversations (is_public=false)
- `public`: Only published conversations (is_public=true)
- `all`: All conversations (default)

#### Message Count
Metadata includes `message_count` (handles encrypted messages correctly by checking both `messages` array and `messages_encrypted` field).

#### Stream Metadata
Stores checkpoint data for stream resumption:

**Functions:**
- `set_stream_metadata(conversation_id, stream_id, connection_token, last_stage, profile_id)`
- `get_stream_metadata(conversation_id, profile_id)`
- `clear_stream_metadata(conversation_id, profile_id)`

**Metadata Structure:**
```json
{
  "stream_metadata": {
    "stream_id": "abc-123-def",
    "connection_token": "eyJ...",
    "last_stage": "stage1_5",
    "updated_at": "2025-11-29T10:30:00Z"
  }
}
```

**Behavior:**
- Cleared after stream completion
- Cleared after 2hr expiry
- Used by resume endpoint to determine remaining stages

#### Progressive Message Building
`save_partial_assistant_message(conversation_id, assistant_message, profile_id)`:
- Handles incremental saves during streaming
- Updates existing assistant message in place
- Preserves all existing fields
- Used for resilience (partial data preserved on crashes)

## Encryption (`encryption.py`)

### Overview
- Symmetric encryption using Fernet (AES-128-CBC)
- **What's encrypted**: Only `messages[]` array (user/assistant message content)
- **What's NOT encrypted**: All metadata (id, title, timestamps, is_public, etc.)

### Rationale
Metadata must be searchable/indexable without decryption. This allows:
- Listing conversations by title
- Sorting by date
- Filtering by public/private status
- Displaying sync status
- All without decrypting message content

### Provider Architecture

**`EncryptionProvider`** - Abstract Base Class
```python
class EncryptionProvider(ABC):
    @abstractmethod
    def encrypt(self, data: bytes) -> bytes: ...

    @abstractmethod
    def decrypt(self, data: bytes) -> bytes: ...
```

**`FernetProvider`** - Current Implementation
```python
class FernetProvider(EncryptionProvider):
    def __init__(self, key: str):
        self.fernet = Fernet(key.encode())

    def encrypt(self, data: bytes) -> bytes:
        return self.fernet.encrypt(data)

    def decrypt(self, data: bytes) -> bytes:
        return self.fernet.decrypt(data)
```

**`RSAProvider`** - Placeholder for Future
```python
class RSAProvider(EncryptionProvider):
    # Future asymmetric encryption support
    pass
```

### Utility Functions

**`encrypt_data(data: Any, provider: EncryptionProvider) -> str`**
- Converts Python object to JSON
- Encrypts with provider
- Returns base64-encoded ciphertext

**`decrypt_data(encrypted_data: str, provider: EncryptionProvider) -> Any`**
- Decodes base64 ciphertext
- Decrypts with provider
- Parses JSON and returns Python object

**`generate_fernet_key() -> str`**
- Generates secure Fernet key
- Returns base64-encoded key string
- Used by `scripts/generate_encryption_key.py`

**`is_encrypted(conversation: dict) -> bool`**
- Checks for presence of `_encryption` or `messages_encrypted` field
- Used to detect encrypted conversations

### Key Management

**Location:**
- Single encryption key per installation in `.env` file
- `ENCRYPTION_KEY=<base64-encoded-key>`

**Generation:**
- Auto-generated via `scripts/generate_encryption_key.py` if missing
- Script appends key to `.env` file

**Backup:**
- User responsible for backing up `.env` file
- **No key recovery mechanism**
- Lost key = permanently lost conversations (by design)

### Backward Compatibility

**Detection:**
- Automatic detection of encryption via `is_encrypted()` function
- Checks for `_encryption` or `messages_encrypted` field

**Migration:**
- Legacy unencrypted files load transparently
- Re-encrypted on next save (no manual migration)
- Zero-downtime migration path

**Example:**
```python
conversation = storage.get_conversation(conversation_id, profile_id)
# Returns decrypted messages if encrypted, plain messages if not

# Modify conversation
conversation["title"] = "New Title"

# Save re-encrypts automatically if encryption enabled
storage.save_conversation(conversation, profile_id)
```

### Security Considerations

**Encryption Enabled by Default:**
- `ENCRYPTION_ENABLED=true` in config

**Fail Securely:**
- Throws error if encrypted file found but key missing
- No plaintext fallback once encryption enabled

**Audit Trail:**
- Encryption/decryption operations logged to audit log
- Includes user ID, conversation ID, timestamp

### Future-Proofing

**Provider Abstraction:**
- Supports future asymmetric encryption (RSA)
- Supports hybrid encryption (RSA + AES)

**Version Field:**
- `_encryption.version` allows migration between schemes
- Example: v1.0 (Fernet) → v2.0 (RSA+AES hybrid)

**Architecture Ready:**
- `RSAProvider` placeholder exists
- Key exchange mechanism TBD
- Not yet implemented

## Profile-Based Multi-Tenancy

### Profile Management

**Functions:**
- `list_profiles()`: List all profiles
- `create_profile(profile_id, name)`: Create new profile
- `update_profile(profile_id, updates)`: Update profile metadata
- `delete_profile(profile_id)`: Delete profile (and all conversations)

**Storage:**
- Profiles stored in centralized `data/profiles.json`
- Each profile has: `{id, name, created_at, owner_id}`

### Conversation Organization

**Directory Structure:**
- Conversations organized by profile_id
- `data/conversations/profile_<id>/`
- Each profile has separate conversation namespace

**Mode Handling:**
- **Local mode**: Auto-uses "default" profile
- **Production mode**: Requires authentication, uses user's profile

### Access Control

**Profile Ownership:**
- Users can only access their own profiles (based on profile_id ownership)
- `user_has_profile_access()` validates profile ownership
- Prevents horizontal privilege escalation

**Implementation:**
```python
# backend/auth_middleware.py
def user_has_profile_access(user: dict, profile_id: str) -> bool:
    if not user:
        return profile_id == "default"  # Local mode

    # Production mode: check ownership
    return user.get("profile_id") == profile_id
```

## Public/Private Conversation Model

### Publish/Forum Functions

**`publish_conversation(conversation_id, profile_id)`**
- Sets `is_public=true`
- Sets `published_at` timestamp
- Updates `sync_status` to "synced"
- Conversation appears in forum

**`unpublish_conversation(conversation_id, profile_id)`**
- Sets `is_public=false`
- Clears `published_at` timestamp
- Conversation removed from forum

**`list_public_conversations()`**
- Returns only public conversations across all profiles
- No authentication required
- Used by forum view

**`get_public_conversation(conversation_id)`**
- Get specific public conversation without auth
- Returns 404 if conversation is private
- Used by forum conversation detail view

### Sync Status

**Values:**
- `local`: Conversation only on local storage (not yet saved)
- `syncing`: Save in progress
- `synced`: Saved to backend

**UI Display:**
- 💾 (local): Only in browser
- ⏳ (syncing): Save in progress
- ☁️ (synced): Saved to server

### BYOK Conversations

**BYOK (Bring-Your-Own-Key):**
- Conversations using user's own API keys
- Always private (`uses_byok=true`)
- Cannot be published to forum
- Publish button disabled in UI

**Rationale:**
- BYOK conversations may contain sensitive content
- User's API key should not be shared
- Privacy guarantee for self-hosted deployments

## Alternative: Local-First (AVAILABLE BUT NOT INTEGRATED)

The codebase includes **optional** local-first storage modules in `frontend/src/storage/`:

### `storage/localStorage.js` - Pure Browser Storage

**Features:**
- Conversations in browser localStorage
- Offline-capable, instant operations
- 6.2k lines of code

**Functions:**
- `getAllConversations()`: Get all conversations
- `getConversation(id)`: Get specific conversation
- `createConversation(conversation)`: Create new conversation
- `updateConversation(id, updates)`: Update conversation
- `deleteConversation(id)`: Delete conversation

**Status:** Available but not integrated

### `storage/hybridStorage.js` - Local + Backend Sync

**Features:**
- Local-first with optional cloud sync
- Selective backend sync for public conversations
- 4.9k lines of code

**Functions:**
- Same as localStorage.js
- Plus: `syncConversation(id)`, `syncAllPublicConversations()`

**Status:** Available but not integrated

### Migration Guide

**To switch to local-first:**

1. Replace `api` imports with `storage/hybridStorage` in App.jsx:
```javascript
// Before
import * as api from './api';

// After
import * as storage from './storage/hybridStorage';
```

2. Update all API calls to use synchronous localStorage functions:
```javascript
// Before
const conversations = await api.listConversations();

// After
const conversations = storage.getAllConversations();
```

3. Test publish/unpublish sync flow:
```javascript
// Publish triggers sync to backend
storage.publishConversation(conversationId);

// Unpublish removes from backend
storage.unpublishConversation(conversationId);
```

See `frontend/src/storage/README.md` for complete migration guide.

## Related Documentation
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Backend structure details
- [Frontend Architecture](FRONTEND_ARCHITECTURE.md) - Frontend structure details
- [Authentication](AUTHENTICATION.md) - Auth system and access control
- [Encryption Guide](ENCRYPTION_GUIDE.md) - Detailed encryption documentation
- [Encryption API](ENCRYPTION_API.md) - API documentation for encryption
- `frontend/src/storage/README.md` - Local-first storage migration guide
