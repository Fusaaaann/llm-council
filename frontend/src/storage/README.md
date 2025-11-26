# Storage Layer Documentation

This directory contains the storage layer implementations for LLM Council.

## Files

### `localStorage.js`
Pure browser localStorage implementation for local-first architecture.

**Use when:**
- You want conversations stored locally in the browser
- You need offline support
- You want instant operations without network latency
- Privacy is paramount (data never leaves the device unless explicitly published)

**Key Functions:**
- `getAllConversations()` - Get all conversations from localStorage
- `getConversation(id)` - Get single conversation
- `createConversation(usesByok)` - Create new conversation locally
- `updateConversation(id, updates)` - Update conversation
- `deleteConversation(id)` - Delete conversation
- `publishConversation(id)` - Mark as public locally
- `unpublishConversation(id)` - Mark as private locally
- `getCurrentProfileId()` / `setCurrentProfileId(id)` - Profile management

### `hybridStorage.js`
Hybrid storage combining localStorage (primary) with backend API (sync).

**Use when:**
- You want local-first behavior with optional cloud sync
- You want to publish conversations to a public forum
- You want the best of both worlds: local performance + cloud backup

**Architecture:**
1. **Local-First:** All operations happen in localStorage first
2. **Selective Sync:** Only public conversations sync to backend
3. **Graceful Degradation:** If backend fails, local state is preserved
4. **Rollback on Error:** Failed sync operations rollback local state

**Key Functions:**
- All functions from `localStorage.js` plus:
- `publishConversation(id)` - Publishes to backend AND marks synced locally
- `unpublishConversation(id)` - Unpublishes from backend
- `listForumConversations()` - Get public conversations from backend
- `getForumConversation(id, profileId)` - Get specific public conversation

## Usage Examples

### Using localStorage (Pure Local)
```javascript
import * as localStorage from './storage/localStorage.js';

// Create a conversation
const conv = localStorage.createConversation(false);

// Add messages
localStorage.addUserMessage(conv.id, 'Hello!');
localStorage.addAssistantMessage(conv.id, stage1, stage2, stage3);

// Get all conversations
const conversations = localStorage.getAllConversations();
```

### Using hybridStorage (Local + Sync)
```javascript
import * as hybridStorage from './storage/hybridStorage.js';

// Create a conversation (stored locally)
const conv = hybridStorage.createConversation(false);

// ... add messages ...

// Publish to forum (syncs to backend)
await hybridStorage.publishConversation(conv.id);

// View public conversations
const publicConvs = await hybridStorage.listForumConversations();
```

### Using API (Pure Backend)
```javascript
import { api } from '../api.js';

// Create a conversation (stored on backend)
const conv = await api.createConversation();

// ... continue as before ...
```

## Current Implementation

**App.jsx currently uses:** `api.js` (pure backend)

**To switch to local-first:**
1. Replace imports in App.jsx:
   ```javascript
   // OLD:
   import { api } from './api';

   // NEW:
   import * as storage from './storage/hybridStorage';
   ```

2. Update function calls:
   ```javascript
   // OLD:
   await api.createConversation()
   await api.listConversations()

   // NEW:
   storage.createConversation()
   storage.getAllConversations()  // synchronous!
   ```

3. Handle publish/unpublish:
   ```javascript
   // Publish to forum
   await storage.publishConversation(id);

   // Unpublish from forum
   await storage.unpublishConversation(id);
   ```

## Data Flow

### Backend-First (Current)
```
User Action → API Call → Backend Storage → Database → Response → UI Update
```

### Local-First (hybridStorage)
```
User Action → localStorage → UI Update (instant!)
             ↓
             Backend Sync (only if published)
```

### Forum Access
```
User browses forum → Backend API → Returns only public conversations
```

## Sync Status

Conversations have a `sync_status` field:
- `local` - Only in localStorage, not synced
- `syncing` - Currently being synced to backend
- `synced` - Successfully synced to backend

## Public/Private Model

- **Private (default for BYOK):** Never syncs to backend
- **Public (default for non-BYOK):** Can be published to forum
- **Published:** Synced to backend and visible in forum

## Profile Management

Profile ID determines which conversations are visible:
- Stored in localStorage: `llm_council_profile_id`
- Default: `"default"`
- Backend organizes conversations by profile
- Switch profiles to see different conversation sets

## Storage Keys

localStorage uses these keys:
- `llm_council_conversations` - Array of all conversations
- `llm_council_profile_id` - Current profile ID
- `llm_council_settings` - User settings (future use)

## Browser Storage Limits

localStorage has a ~5-10MB limit per origin. Monitor usage:
```javascript
import { exportData } from './storage/localStorage';

const data = exportData();
const sizeKB = new Blob([JSON.stringify(data)]).size / 1024;
console.log(`Storage size: ${sizeKB.toFixed(2)} KB`);
```

If approaching limit:
1. Export old conversations to files
2. Delete old conversations locally
3. Keep important ones published (synced to backend)

## Migration Path

To migrate from backend to local-first:

1. **Export existing conversations:**
   ```javascript
   const conversations = await api.listConversations();
   // Save to localStorage
   localStorage.setItem('llm_council_conversations', JSON.stringify(conversations));
   ```

2. **Switch App.jsx to use hybridStorage**

3. **Publish important conversations to backend**

## Best Practices

1. **Use hybridStorage for most cases** - Gets benefits of both
2. **Publish conversations you want to share** - Makes them accessible in forum
3. **Keep sensitive conversations private** - They stay in localStorage only
4. **Use BYOK flag for API key conversations** - Automatically keeps them private
5. **Export data periodically** - localStorage can be cleared by browser

## Debugging

Export all data for inspection:
```javascript
import { exportData } from './storage/localStorage';
console.log(exportData());
```

Clear all data (use with caution):
```javascript
import { clearAllData } from './storage/localStorage';
clearAllData();
```
