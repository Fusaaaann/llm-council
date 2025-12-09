# Workflow Generator Standalone Page

## Overview

A standalone visual interface for generating workflow DSL definitions using the workflow generator library.

## Access

The workflow generator is accessible via direct URL navigation:

```
http://localhost:5173/workflow-generator
```

**Note:** There is no link to this page in the main navigation (as requested). Access is via direct URL only.

## Features

### Visual Form Builder
- **Workflow Settings**: Configure flow ID and global timeout
- **Variables**: Add/remove variables with types (string, json_object, list)
- **Supersteps**: Build multi-step workflows with:
  - Map phase (workers configuration)
  - Middleware phase (filtering, truncation, refinement)
  - Reduce phase (synthesis strategies)

### Preset Templates
Quick-start templates for common patterns:
- **Simple Debate**: Two opposing perspectives with chairman synthesis
- **Blind Review**: Anonymous evaluation of multiple responses

### Worker Configuration
- Worker ID and model selection
- Role definitions (with default role support)
- Global instructions for entire phase
- Concurrency limits

### Reduce Phase Options
- **Strategies**: Council Chairman, Simple Summary, Vote Majority, Subquery Single Model, Cross Interrogation
- **Visibility Presets**: Full, Blind Review, Clean Subquery
- **Variable Interpolation**: Enable `${variable}` substitution
- **Chairman Instructions**: Custom instructions for synthesis

### Actions
- **Generate Workflow**: Build JSON from form inputs
- **Validate**: Validate against backend schema and check model references
- **Download JSON**: Save workflow definition as `.json` file
- **Copy to Clipboard**: Copy JSON for pasting elsewhere

### Live Preview
Real-time JSON preview panel with:
- Formatted JSON output
- Validation results (✅ valid / ❌ errors)
- Syntax highlighting

## Usage Example

1. Navigate to `http://localhost:5173/workflow-generator`
2. (Optional) Click "Simple Debate" to load a preset
3. Modify settings:
   - Update flow ID: `my_custom_workflow`
   - Add variables as needed
   - Configure supersteps and workers
4. Click "Generate Workflow" to see JSON preview
5. Click "Validate" to check against backend schema
6. Click "Download JSON" to save the workflow

## Integration with Backend

The page integrates with the backend workflow API:

- **Validation Endpoint**: `POST /api/workflows/validate`
  - Validates DSL schema compliance
  - Checks model references against OpenRouter
  - Returns validation errors if any

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── WorkflowGeneratorPage.jsx    # Main generator component
│   │   └── WorkflowGeneratorPage.css    # Styling
│   ├── workflowGenerator.js             # Builder library
│   ├── api.js                            # API client (with validateWorkflow)
│   └── main.jsx                          # Routes (/, /workflow-generator)
```

## Technical Details

### Routing
Uses React Router with two routes:
- `/` - Main LLM Council app
- `/workflow-generator` - Standalone generator page

### State Management
- Form state managed locally in component
- No shared state with main app
- Generates workflow on-demand using builder pattern

### Builder Library
Uses the existing `workflowGenerator.js` library with:
- `createWorkflow()` - Workflow builder
- `createSuperstep()` - Superstep builder
- Helper constants: `strategies`, `models`, `visibility`, `middleware`

## Future Enhancements

- Save workflows to backend (POST /api/workflows)
- Load existing workflows for editing (GET /api/workflows/{id})
- Drag-and-drop superstep reordering
- Middleware visual builder
- Import from JSON file
- Export to multiple formats
- Visual workflow diagram
- Test execution directly from UI

## Related Documentation

- [Workflow Generator README](frontend/WORKFLOW_GENERATOR_README.md) - Builder library documentation
- [DSL Schema](dsl-schema.json) - Full schema reference
- [Backend Workflows API](backend/routes/workflows.py) - API endpoints
