# Storybook Guide - LLM Council

## 🎨 Overview

Comprehensive Storybook stories have been created to visualize and interact with all major LLM Council components. This provides an isolated development environment for building, testing, and documenting the UI.

## 📂 Files Created

```
frontend/src/stories/
├── mockData.js                    # Realistic mock data for all components
├── UnifiedStage.stories.jsx       # Council & workflow execution rendering
├── ChatInterface.stories.jsx      # Main conversation interface
├── Sidebar.stories.jsx            # Navigation and conversation management
├── WorkflowBuilder.stories.jsx    # Workflow visualization from JSON
└── README.md                      # Detailed documentation

frontend/.storybook/
└── preview.js                     # Updated to import component CSS globally
```

## 🚀 Quick Start

```bash
# Install dependencies (if not already done)
cd frontend
npm install

# Run Storybook development server
npm run storybook
# Opens at http://localhost:6006

# Build static Storybook (for deployment)
npm run build-storybook
# Output in storybook-static/
```

## 📚 Available Stories

### 1. **Components/UnifiedStage** - 10 Stories
Auto-detecting component that renders council deliberations or workflow executions.

**Council Mode:**
- ✅ Stage 1 Only (partial)
- ✅ Stages 1 & 2 (partial)
- ✅ Complete 4-stage deliberation
- ✅ Loading states

**Workflow Mode:**
- ✅ Complete workflow with final output
- ✅ In-progress with progress bar
- ✅ Worker perspectives expanded
- ✅ Side-by-side comparison

### 2. **Components/ChatInterface** - 11 Stories
Main conversation UI with messaging, actions, and streaming.

**States:**
- ✅ Empty states (no conversation, no messages)
- ✅ User message with edit/retry actions
- ✅ Council conversations (single & multi-turn)
- ✅ Workflow conversations
- ✅ Streaming/loading states
- ✅ Read-only mode (public conversations)
- ✅ Interactive playground

### 3. **Components/Sidebar** - 10 Stories
Navigation sidebar with conversation management.

**Features:**
- ✅ Empty state
- ✅ Conversation list with selection
- ✅ Logged in/out states
- ✅ Private vs Public view toggle
- ✅ Status badges (☁️ synced, ⏳ syncing, 💾 local)
- ✅ Public/BYOK badges (🌐 🔑)
- ✅ Loading indicators
- ✅ Context menu (rename, delete, export, publish)
- ✅ Interactive demo with full state management

### 4. **Workflows/WorkflowBuilder** - 5 Stories
Visualizes workflow configurations from hardcoded JSON presets.

**Workflows:**
- ✅ Classic Council (3-stage deliberation with scope alignment)
- ✅ Perspective Matrix (3 models × 4 perspectives = 12 workers)
- ✅ Debate with Scope Alignment
- ✅ Side-by-side comparison
- ✅ Interactive JSON editor + visualization

## 🎯 Key Features Demonstrated

### UnifiedStage Component
- **Auto-detection**: Automatically detects council vs workflow mode from message structure
- **Council Mode**: Traditional 4-stage tabs (Stage 1, 1.5, 2, 3) with loading indicators
- **Workflow Mode**: Variable display, worker perspectives, progress tracking
- **Responsive**: Adapts UI based on execution type

### ChatInterface Component
- **Message Display**: User/assistant messages with markdown rendering
- **Actions**: Edit/Retry on last user message, Stop during streaming
- **Model Config**: Integrated model configuration modal
- **Read-Only**: Public conversation view mode
- **Auto-scroll**: Smooth scrolling to latest message

### Sidebar Component
- **Real-time Updates**: Sync status indicators
- **Multi-tenant**: Public/private view toggle
- **Context Menu**: Rename, delete, export (markdown/HTML/JSON), publish
- **Authentication**: Login/logout UI integration
- **Badges**: Visual indicators for public, BYOK, loading states

### WorkflowBuilder Component
- **Visual Structure**: Supersteps, map/reduce phases, workers
- **Perspective Matrix**: Shows combinatorial expansion (models × perspectives)
- **Scope Alignment**: Highlights pre-execution coordination
- **Interactive**: JSON editor with live visualization
- **Collapsible**: Expandable sections for detailed inspection

## 📖 Mock Data

All stories use realistic mock data from `mockData.js`:

### Council Execution
```javascript
{
  role: 'assistant',
  stage1: [...],        // 3 model responses
  stage1_5: {...},      // Cross-interrogation Q&A
  stage2: [...],        // Peer rankings
  stage3: {...},        // Chairman synthesis
  metadata: {...}       // Label mappings, aggregate rankings
}
```

### Workflow Execution
```javascript
{
  role: 'assistant',
  variables: {...},     // All workflow variables
  worker_outputs: {...},// Worker perspectives by superstep
  metadata: {
    workflow_id: '...',
    completed_steps: 1,
    total_steps: 2
  }
}
```

### Conversations & Sidebar
- Multiple conversation states (empty, single-turn, multi-turn)
- Various sync statuses (synced, syncing, local)
- Badge combinations (public, BYOK, loading)
- User authentication states

## 🧪 Use Cases

### 1. **Component Development**
Develop components in isolation without running the full backend:
```bash
npm run storybook
# Navigate to Components/ChatInterface
# Use Controls panel to modify props in real-time
```

### 2. **Visual Testing**
Verify UI appearance across different states:
- Check all loading states work correctly
- Verify responsive design with viewport addon
- Test dark mode compatibility (if enabled)

### 3. **Documentation**
Auto-generated component documentation:
- View all props and their types
- See usage examples
- Check accessibility recommendations

### 4. **Interaction Testing**
Use Actions panel to monitor events:
```javascript
// In Interactive stories, check Actions panel to see:
onSendMessage: (msg) => ...
onEditMessage: (content) => ...
onRetryMessage: (content) => ...
```

### 5. **Accessibility Testing**
Built-in a11y addon checks for violations:
- Navigate to any story
- Open "Accessibility" panel
- Review and fix violations

## 🛠️ Development Workflow

### Adding New Stories

1. **Create story file** in `frontend/src/stories/`
```javascript
// MyComponent.stories.jsx
import MyComponent from '../components/MyComponent';

export default {
  title: 'Components/MyComponent',
  component: MyComponent
};

export const Default = {
  args: { prop1: 'value' }
};
```

2. **Add mock data** (if needed) to `mockData.js`

3. **Import CSS** in `.storybook/preview.js` (if new component)

4. **Test locally**
```bash
npm run storybook
```

### Modifying Existing Stories

1. Edit the story file directly
2. Hot reload shows changes immediately
3. Check Actions panel for event logs
4. Use Controls panel to tweak props

### Building for Production

```bash
# Build static Storybook
npm run build-storybook

# Output directory: storybook-static/
# Deploy to any static hosting (Netlify, Vercel, GitHub Pages, etc.)
```

## 🎨 Storybook Addons

Currently enabled:
- **@chromatic-com/storybook** - Visual testing
- **@storybook/addon-vitest** - Component testing
- **@storybook/addon-a11y** - Accessibility checks
- **@storybook/addon-docs** - Auto-generated docs
- **@storybook/addon-onboarding** - First-time guide

### Suggested Additional Addons
```bash
# Responsive design testing
npm install --save-dev @storybook/addon-viewport

# State management integration
npm install --save-dev @storybook/addon-redux

# Performance monitoring
npm install --save-dev @storybook/addon-performance
```

## 📊 Story Organization

Stories follow this naming convention:
```
title: 'Category/ComponentName'
       └─────┬────┘ └─────┬─────┘
             │            └── Component name
             └── Category (Components, Workflows, etc.)
```

Current categories:
- **Components/** - UI components (UnifiedStage, ChatInterface, Sidebar)
- **Workflows/** - Workflow visualization and builder

## 💡 Tips & Tricks

### 1. Use Controls Panel
Modify component props in real-time without code changes.

### 2. Monitor Actions Panel
See all event callbacks logged (onSendMessage, onClick, etc.).

### 3. Keyboard Shortcuts
- `S` - Show/hide sidebar
- `A` - Show/hide addons panel
- `F` - Toggle fullscreen
- `D` - Toggle dark mode (if enabled)

### 4. Viewport Testing
Use viewport addon toolbar to test mobile/tablet/desktop views.

### 5. Permalink Stories
Share specific stories with teammates via URL:
```
http://localhost:6006/?path=/story/components-chatinterface--council-conversation
```

### 6. Visual Regression Testing
Use Chromatic addon for automated visual testing:
```bash
npm run chromatic
```

## 🔗 Related Documentation

- [Storybook Official Docs](https://storybook.js.org/docs)
- [Stories README](frontend/src/stories/README.md)
- [Frontend Architecture](ai_notes/FRONTEND_ARCHITECTURE.md)
- [Unified Stage Architecture](ai_notes/UNIFIED_STAGE_ARCHITECTURE.md)
- [Workflow Quick Reference](ai_notes/WORKFLOW_QUICK_REFERENCE.md)

## 🐛 Troubleshooting

### Storybook won't start
```bash
# Clear cache and reinstall
rm -rf node_modules/.cache
npm install
npm run storybook
```

### CSS not loading
Check `.storybook/preview.js` has component CSS imports.

### Mock data errors
Verify mock data structure matches component prop types.

### Workflow JSON not found
Check import paths are relative to `frontend/src/stories/`:
```javascript
import workflow from '../../../examples/workflows/file.json';
```

## 📝 Next Steps

### Suggested Enhancements
1. **Add Interaction Tests**: Use `@storybook/addon-interactions`
2. **Visual Regression**: Set up Chromatic CI pipeline
3. **Component Testing**: Add Vitest component tests
4. **Performance**: Add performance monitoring addon
5. **Themes**: Add dark mode toggle support
6. **More Workflows**: Add stories for all workflow types in `examples/`

---

**Created**: 2025-12-10
**Last Updated**: 2025-12-10
**Stories Count**: 36+ across 4 components
