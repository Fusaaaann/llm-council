# Frontend Architecture

Complete implementation details for the frontend structure in LLM Council.

## Overview

React-based frontend with configuration-driven event handling, real-time SSE updates, and comprehensive UI for the deliberation system.

## Core Structure (`frontend/src/`)

### API Client (`api.js`)

**Core Functions:**
- `fetchWithAuth()`: Enhanced fetch with automatic token refresh
- `refreshAccessToken()`: Handles token rotation (single-use refresh tokens)
- `sendMessageStream()`: Wrapper with network resilience (see SSE section)
- `subscribeToConversationUpdates()`: EventSource for real-time sidebar updates

**Endpoints Grouped by Feature:**
- Authentication: `register()`, `login()`, `logout()`, `getCurrentUser()`
- Conversations: `listConversations()`, `createConversation()`, `getConversation()`, `deleteConversation()`
- Messaging: `sendMessage()` (batch), `sendMessageStream()` (streaming, preferred)
- Forum: `listForumConversations()`, `getForumConversation()`
- Profiles: `listProfiles()`, `createProfile()`, `updateProfile()`, `deleteProfile()`
- Encryption: `getEncryptionStatus()`, `encryptConversation()`, `decryptConversation()`
- Publish: `publishConversation()`, `unpublishConversation()`

**Key Implementation Details:**
- Reads current profile ID from localStorage
- Includes `profile_id` as query parameter in all API calls
- EventSource accepts token as query param (since custom headers not supported)
- **Proactive token refresh**: Checks JWT expiry before streaming (< 5 min threshold)
- **Streaming-specific handling**: Uses direct fetch() for streams to prevent connection loss

### Main Application (`App.jsx`)

**Responsibilities:**
- Main orchestration: manages conversations list and current conversation
- Handles message sending via streaming API (`sendMessageStream`)
- Auth state management
- Real-time SSE subscription for conversation list updates

**Message Handlers:**
- `handleEditMessage()`: Removes last user message + assistant response, populates input field
- `handleRetryMessage()`: Removes last assistant response, resends user message
- `handleCancelMessage()`: Cancels ongoing stream via AbortController
- `handlePublishConversation()`: Publishes conversation to forum
- `handleUnpublishConversation()`: Unpublishes conversation from forum

**Event Handling (Configuration-Driven):**
- Creates dynamic event handler from `eventHandler.js` factory
- Delegates all stage events to dynamic handler (automatic handling)
- Only handles special events in switch statement (title, complete, error, heartbeat, auth_expired)
- **Code reduction:** 200 lines → 50 lines
- Handles auth expiration during streams (refreshes token or logs out)

**State Management:**
- Metadata persisted in backend and reloaded from storage
- Progressive UI updates: each stage updates in real-time as events arrive
- Tracks reconnection status for network resilience

### Stage Configuration (`stageConfig.js`)

**Purpose:**
- Centralized stage definitions
- Single source of truth for stage names and event types

**Configuration:**
Defines all deliberation stages in one place:
- Stage names and order (`stage1`, `stage1_5`, `stage2`, `stage3`)
- Event types (`{stage}_start`, `{stage}_complete`)
- Data field mapping (which message field to update)
- Loading messages
- Sub-stage support (for complex stages like 1.5)

**Export Functions:**
- `getStageConfig(name)`: Get config for specific stage
- `getStageForEvent(eventType)`: Find which stage handles an event
- `isSpecialEvent(eventType)`: Check if event is non-stage event
- `getAllEventTypes()`: Get all valid event types

**Special Events:**
- `stream_init`, `complete`, `error`, `heartbeat`, `reconnected`, `auth_expired`, `title_complete`

### Event Handler Factory (`eventHandler.js`)

**Purpose:**
- Dynamic event handler generation from configuration
- Eliminates hardcoded switch statements

**Main Function:**
- `createStreamEventHandler(callbacks)`: Factory function that generates handlers
  - Takes callbacks: `updateQueryState`, `setConversation`
  - Returns: `handleEvent(eventType, event, conversationId)` function

**Automatic Handling:**
- Start events → update query state to 'loading'
- Complete events → update message data, mark stage complete
- Complex stages (1.5) → handle sub-stages with custom data handlers
- Metadata stages (stage2) → merge metadata into message
- Returns `true` if event was handled, `false` for special events

**Helper Functions:**
- `ensureAssistantMessage()`: Create assistant message if missing
- `getLoadingMessage(stageName)`: Get loading text for stage

## UI Components

### `ChatInterface.jsx` - Main Chat UI

**Features:**
- Input field always visible for multi-turn conversations
- Multiline textarea (3 rows, resizable) with ref for programmatic focus
- Enter to send, Shift+Enter for new line
- User messages wrapped in markdown-content class for padding

**Action Buttons:**
- Edit/Retry/Cancel buttons on last user message (when not loading)
- Edit button populates input field and focuses it
- Cancel button aborts ongoing stream
- Progressive loading indicators for each stage during streaming

**Additional Features:**
- Model configuration UI (change council/chairman models)
- Encryption controls component integration

**Stage Rendering (Configuration-Driven):**
- Dynamically renders all stages from `STAGES` config
- Component mapping: `STAGE_COMPONENTS` maps stage names to React components
- Props mapping: `STAGE_PROPS_MAPPER` generates component props from message data
- Loading indicators use `stageConfig.label` and `stageConfig.loadingMessage`
- **Code reduction:** 50 lines of hardcoded JSX → 25 lines of dynamic rendering

### Stage Display Components

#### `Stage1.jsx` - Initial Responses
- Tab view of individual model responses
- ReactMarkdown rendering with markdown-content wrapper

#### `Stage1_5.jsx` - Cross-Interrogation Display
- Tab view showing each model's Q&A session
- **Three collapsible sections per model:**
  - 📝 Questions Received (from other models)
  - 💬 Answers Provided (responses to questions)
  - 📄 Original Response (reference, collapsed by default)
- Shows question metadata (from which model)
- De-anonymizes model names in displayed text
- Expandable/collapsible sections for better UX

#### `Stage2.jsx` - Peer Review
- Tab view showing RAW evaluation text from each model
- De-anonymization happens CLIENT-SIDE for display (models receive anonymous labels)
- Shows "Extracted Ranking" below each evaluation so users can validate parsing
- Aggregate rankings shown with average position and vote count
- Explanatory text clarifies that boldface model names are for readability only

#### `Stage3.jsx` - Final Synthesis
- Final synthesized answer from chairman
- Green-tinted background (#f0fff0) to highlight conclusion

### `Sidebar.jsx` - Conversation List

**Features:**
- Shows conversation list with metadata
- Real-time updates via SSE (no manual refresh needed)
- Context menu for conversation actions

**UI Elements:**
- Sync status icon: 💾 (local), ⏳ (syncing), ☁️ (synced)
- Public badge: 🌐 (visible for public conversations)
- BYOK badge: 🔑 (visible for BYOK conversations)
- Loading spinner for conversations being processed

**Context Menu Options:**
- Rename, Publish/Unpublish, Export (Markdown), Delete
- Publish disabled for BYOK conversations

**Additional Features:**
- About button opens AboutModal
- Auth section (login/logout, user display)

### `AboutModal.jsx` - User Documentation

**Features:**
- Modal overlay displaying about/documentation content
- Fetches markdown from `/docs/about.md` endpoint
- ReactMarkdown rendering with loading and error states
- "Got it" button to close

### `EncryptionControls.jsx` - Encryption Management

**Features:**
- Shows encryption status (encrypted/plaintext)
- Displays provider and version when encrypted
- Encrypt/decrypt buttons for manual control
- Confirmation dialogs before operations
- Info text explaining what's encrypted (messages, not metadata)

## Styling

### Theme
- Light mode theme (not dark mode)
- Primary color: #4a90e2 (blue)

### Global Styles (`index.css`)
- Global markdown styling with `.markdown-content` class
- 12px padding on all markdown content to prevent cluttered appearance

### Component Styles
- New styles for sync icons, badges, and disabled buttons in `Sidebar.css`
- Stage-specific styles in respective CSS files

## Event-Driven Updates

### SSE Subscription Pattern

**Implementation:**
```javascript
useEffect(() => {
  const eventSource = api.subscribeToConversationUpdates(handleEvent, currentView);
  return () => eventSource.close();
}, [currentView]);
```

**Event Handlers:**
- `initial`: Set full conversation list
- `conversation_created`: Append to list
- `conversation_updated`: Update in-place (title, loading state, etc.)
- `conversation_deleted`: Remove from list
- `heartbeat`: Keep-alive (no action)

**Benefits:**
- Instant updates without polling
- Multiple tabs/windows stay synchronized
- Reduced server load (push vs poll)
- Automatic reconnection on network drops

## Storage Architecture

### Current Implementation: Backend-First

**Data Flow:**
```
User Action → API Call → Backend → Storage → Response → UI Update
```

**Details:**
- All conversations stored in `data/conversations/profile_<id>/` on backend
- All operations go through REST API
- No local storage caching (except auth tokens)

### Alternative: Local-First (AVAILABLE BUT NOT INTEGRATED)

The codebase includes **optional** local-first storage modules in `frontend/src/storage/`:

**`storage/localStorage.js`** - Pure browser storage (6.2k lines, UNUSED)
- Conversations in browser localStorage
- Offline-capable, instant operations
- Functions: `getAllConversations()`, `getConversation()`, `createConversation()`, `updateConversation()`, `deleteConversation()`
- **Status:** Available but not integrated

**`storage/hybridStorage.js`** - Local + backend sync (4.9k lines, UNUSED)
- Local-first with optional cloud sync
- Selective backend sync for public conversations
- **Status:** Available but not integrated

**To switch to local-first:**
1. Replace `api` imports with `storage/hybridStorage` in App.jsx
2. Update all API calls to use synchronous localStorage functions
3. Test publish/unpublish sync flow

See `frontend/src/storage/README.md` for migration guide.

## Design Decisions

### Markdown Rendering
All ReactMarkdown components must be wrapped in `<div className="markdown-content">` for proper spacing. This class is defined globally in `index.css`.

### De-anonymization Strategy
- Models receive: "Response A", "Response B", etc.
- Backend creates mapping: `{"Response A": "openai/gpt-5.1", ...}`
- Frontend displays model names in **bold** for readability
- Users see explanation that original evaluation used anonymous labels
- This prevents bias while maintaining transparency

### UI/UX Transparency
- All raw outputs are inspectable via tabs
- Parsed rankings shown below raw text for validation
- Users can verify system's interpretation of model outputs
- This builds trust and allows debugging of edge cases

## Related Documentation
- [Backend Architecture](BACKEND_ARCHITECTURE.md) - Backend structure details
- [Event Handling](EVENT_HANDLING.md) - Configuration-driven event system details
- [Storage Architecture](STORAGE_ARCHITECTURE.md) - Storage and encryption details
- [Authentication](AUTHENTICATION.md) - Auth system details
- [SSE Network Resilience](SSE_NETWORK_RESILIENCE.md) - Stream resumption details
- `frontend/src/storage/README.md` - Local-first storage migration guide
