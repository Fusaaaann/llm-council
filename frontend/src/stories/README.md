# LLM Council Storybook Stories

Comprehensive Storybook stories for visualizing and testing LLM Council components.

## 📚 Available Stories

### 1. **UnifiedStage** (`UnifiedStage.stories.jsx`)
Adaptive component that renders both Council and Workflow execution modes.

**Council Mode Stories:**
- `CouncilStage1Only` - Partial execution (Stage 1 only)
- `CouncilStage1And2` - Partial execution (Stages 1 & 2)
- `CouncilComplete` - Full 4-stage deliberation
- `CouncilLoading` - Loading state during Stage 1.5

**Workflow Mode Stories:**
- `WorkflowComplete` - Complete workflow with final output
- `WorkflowInProgress` - Partial workflow with progress bar
- `WorkflowWithPerspectives` - Worker perspectives expanded

**Comparison:**
- `CouncilVsWorkflow` - Side-by-side comparison of both modes

### 2. **ChatInterface** (`ChatInterface.stories.jsx`)
Main conversation interface for user interaction.

**Basic States:**
- `NoConversation` - Empty state (no conversation selected)
- `EmptyConversation` - New conversation with no messages
- `UserMessageOnly` - Single user message with actions

**Council Conversations:**
- `CouncilConversation` - Complete council deliberation
- `MultiTurnConversation` - Extended multi-turn exchange

**Workflow Conversations:**
- `WorkflowConversation` - Perspective matrix execution

**Loading States:**
- `StreamingResponse` - Active streaming with Stop button
- `LoadingStage1_5` - Stage 1.5 loading indicator

**Interaction:**
- `ReadOnlyMode` - Public conversation (view only)
- `WithEditRetryActions` - Edit/retry buttons visible
- `Interactive` - Full interactive playground

### 3. **Sidebar** (`Sidebar.stories.jsx`)
Navigation and conversation management sidebar.

**Basic States:**
- `EmptyState` - No conversations yet
- `WithConversations` - Conversation list with active selection
- `LoggedOut` - Unauthenticated state

**View Modes:**
- `PrivateView` - My Conversations (with menu buttons)
- `PublicView` - Public Forum (read-only list)

**Badge Display:**
- `StatusBadges` - Sync status (☁️⏳💾), public (🌐), BYOK (🔑)
- `LoadingIndicator` - Streaming in progress spinner

**Interactive:**
- `InteractiveDemo` - Fully stateful with rename/delete/publish
- `ContextMenuOpen` - Visual representation of menu

### 4. **WorkflowBuilder** (`WorkflowBuilder.stories.jsx`)
Visualize workflow configurations from JSON.

**Workflow Types:**
- `ClassicCouncil` - Traditional 3-stage deliberation
- `PerspectiveMatrix` - 3 models × 4 perspectives = 12 workers
- `DebateWithScopeAlignment` - Pre-execution scope alignment

**Comparisons:**
- `WorkflowComparison` - Side-by-side workflow architectures
- `WorkflowJSONEditor` - Interactive JSON viewer + visualization

## 🎯 Mock Data

All stories use realistic mock data from `mockData.js`:

- **Council Messages**: Complete 4-stage deliberations with cross-interrogation
- **Workflow Messages**: Perspective matrix with worker outputs
- **Conversations**: Single-turn, multi-turn, council, workflow
- **Sidebar Data**: Various conversation states, badges, sync status
- **Query States**: Loading/complete states for each stage

## 🚀 Running Storybook

```bash
cd frontend
npm run storybook
```

Storybook will open at [http://localhost:6006](http://localhost:6006)

## 📝 Story Organization

Stories are organized by component type:
- `Components/UnifiedStage` - Execution rendering
- `Components/ChatInterface` - Conversation UI
- `Components/Sidebar` - Navigation UI
- `Workflows/WorkflowBuilder` - Workflow visualization

## 🎨 Features Demonstrated

### UnifiedStage
- Auto-detection of council vs workflow mode
- Stage tabs with loading indicators
- Worker perspectives (collapsible)
- Progress tracking for workflows
- Final output highlighting

### ChatInterface
- Markdown rendering
- Edit/Retry actions on last user message
- Stop/Cancel during streaming
- Read-only mode for public conversations
- Model configuration modal integration

### Sidebar
- Conversation selection and highlighting
- Public/Private view toggle
- Context menu (rename, delete, export, publish)
- Status badges (sync, public, BYOK)
- Loading spinner during streaming
- Authentication UI

### WorkflowBuilder
- Superstep visualization
- Map/Reduce phase details
- Perspective matrix expansion
- Scope alignment indicators
- Variable tracking
- Worker configuration display

## 🧪 Testing with Storybook

Use these stories to:
1. **Visual regression testing** - Catch UI changes
2. **Component development** - Build in isolation
3. **Documentation** - Show component usage
4. **Accessibility testing** - a11y addon enabled
5. **Interactive testing** - Use Actions panel to monitor events

## 📖 Documentation

Each story includes:
- **Description** - What the story demonstrates
- **Args** - Component props
- **Actions** - Event logging (check Actions panel)
- **Docs** - Auto-generated documentation

## 🔧 Configuration

Storybook configuration in `.storybook/`:
- `main.js` - Addon configuration, story locations
- `preview.js` - Global CSS imports, parameters
- `vitest.setup.js` - Vitest integration

## 💡 Tips

1. **Use Controls panel** to modify props in real-time
2. **Check Actions panel** to see event callbacks
3. **Toggle dark mode** using Storybook toolbar
4. **Use viewport addon** to test responsive design
5. **Run accessibility checks** via a11y addon

## 🔗 Related Documentation

- [Storybook Documentation](https://storybook.js.org/docs)
- [LLM Council Architecture](../../../ai_notes/FRONTEND_ARCHITECTURE.md)
- [Unified Stage Architecture](../../../ai_notes/UNIFIED_STAGE_ARCHITECTURE.md)
- [Workflow Quick Reference](../../../ai_notes/WORKFLOW_QUICK_REFERENCE.md)
