// Import global component CSS for Storybook
import '../src/components/UnifiedStage.css';
import '../src/components/ChatInterface.css';
import '../src/components/Sidebar.css';
import '../src/components/Stage1.css';
import '../src/components/Stage2.css';
import '../src/components/Stage3.css';
import '../src/components/Stage1_5.css';
import '../src/components/ModelConfig.css';
import '../src/components/workflow-editor/WorkflowWizard.css';

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo"
    }
  },
};

export default preview;