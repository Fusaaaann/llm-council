import { useState, useEffect } from 'react';
import './ModelConfig.css';
import EncryptionControls from './EncryptionControls';
import { api } from '../api';

export default function ModelConfig({ isOpen, onClose, onSave, currentConversationId, currentConversation }) {
  const [councilModels, setCouncilModels] = useState([]);
  const [chairmanModel, setChairmanModel] = useState('');
  const [newModel, setNewModel] = useState('');
  const [showEncryption, setShowEncryption] = useState(false); // Hidden by default
  const [workflowInput, setWorkflowInput] = useState(''); // Workflow JSON input

  // Model config is read-only for existing conversations (models set at creation)
  const isReadOnly = currentConversation && currentConversation.messages && currentConversation.messages.length > 0;

  useEffect(() => {
    if (isOpen && currentConversation) {
      loadCurrentConfig();
    }
  }, [isOpen, currentConversation, currentConversationId]);

  const loadCurrentConfig = async () => {
    try {
      // Load from current conversation, or fall back to global config
      if (currentConversation) {
        // Use conversation's models (set at creation time)
        // Even for new conversations, backend provides defaults if not specified
        setCouncilModels(currentConversation.council_models || []);
        setChairmanModel(currentConversation.chairman_model || '');
        setWorkflowInput(currentConversation.workflow_json || '');
      } else {
        // No conversation selected - load global defaults
        const data = await api.getModels();
        setCouncilModels(data.council_models);
        setChairmanModel(data.chairman_model);
        setWorkflowInput('');
      }
    } catch (error) {
      console.error('Failed to load model config:', error);
    }
  };

  const handleAddModel = () => {
    if (newModel.trim() && !councilModels.includes(newModel.trim())) {
      setCouncilModels([...councilModels, newModel.trim()]);
      setNewModel('');
    }
  };

  const handleRemoveModel = (model) => {
    setCouncilModels(councilModels.filter((m) => m !== model));
  };

  const handleSave = async () => {
    // Validation: either workflow OR council config, not both
    const hasWorkflow = workflowInput.trim() !== '';
    const hasCouncilConfig = councilModels.length > 0 || chairmanModel.trim() !== '';

    if (!hasWorkflow && !hasCouncilConfig) {
      alert('Please provide either a workflow JSON or council configuration');
      return;
    }

    if (!hasWorkflow) {
      // Validate council config
      if (councilModels.length === 0) {
        alert('Please add at least one council model');
        return;
      }
      if (!chairmanModel.trim()) {
        alert('Please select a chairman model');
        return;
      }
    }

    try {
      // For new conversations (no messages), call onSave to update pending config
      if (!isReadOnly) {
        // Send null for the config mode not being used
        if (hasWorkflow) {
          // Workflow mode: send null for council config
          await onSave(null, null, workflowInput);
        } else {
          // Council mode: send null for workflow
          await onSave(councilModels, chairmanModel, null);
        }
      }
      onClose();
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Configure Models</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {isReadOnly && (
            <div className="info-notice" style={{ background: '#fff3cd', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              <p style={{ margin: 0, color: '#856404' }}>
                ℹ️ Model configuration cannot be changed after sending messages.
                These are the models used for this conversation.
              </p>
            </div>
          )}
          {!isReadOnly && currentConversation && (
            <div className="info-notice" style={{ background: '#d1ecf1', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
              <p style={{ margin: 0, color: '#0c5460' }}>
                💡 You can change models before sending your first message.
              </p>
            </div>
          )}
          <div className="config-section">
            <h3>Council Members</h3>
            <p className="help-text">
              Models that will provide individual responses and peer reviews
            </p>
            {!isReadOnly && (
              <div className="model-input-group">
                <input
                  type="text"
                  placeholder="e.g., openai/gpt-5.1"
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddModel();
                  }}
                  className="model-input"
                  disabled={workflowInput.trim() !== ''}
                />
                <button onClick={handleAddModel} className="add-button" disabled={workflowInput.trim() !== ''}>
                  + Add
                </button>
              </div>
            )}
            <div className="model-list">
              {councilModels.length === 0 ? (
                <div className="empty-list">No council models configured</div>
              ) : (
                councilModels.map((model) => (
                  <div key={model} className="model-item">
                    <span>{model}</span>
                    {!isReadOnly && (
                      <button
                        onClick={() => handleRemoveModel(model)}
                        className="remove-button"
                        disabled={workflowInput.trim() !== ''}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="config-section">
            <h3>Chairman Model</h3>
            <p className="help-text">
              Model that will synthesize the final answer
            </p>
            {!isReadOnly ? (
              <>
                <select
                  value={chairmanModel}
                  onChange={(e) => setChairmanModel(e.target.value)}
                  className="chairman-select"
                  disabled={workflowInput.trim() !== ''}
                >
                  <option value="">Select a model...</option>
                  {councilModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <div className="or-divider">or</div>
                <input
                  type="text"
                  placeholder="Enter custom model"
                  value={chairmanModel}
                  onChange={(e) => setChairmanModel(e.target.value)}
                  className="model-input"
                  disabled={workflowInput.trim() !== ''}
                />
              </>
            ) : (
              <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                {chairmanModel || 'No chairman model set'}
              </div>
            )}
          </div>

          <div className="config-section">
            <details style={{ cursor: 'pointer' }}>
              <summary style={{ fontWeight: 'bold', fontSize: '1.1em', marginBottom: '8px' }}>
                Workflow JSON (Advanced)
              </summary>
              <p className="help-text">
                Use a custom workflow DSL instead of council configuration.
                <a
                  href="/workflow-generator"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginLeft: '4px', color: '#007bff' }}
                >
                  Open Workflow Generator →
                </a>
              </p>
              {!isReadOnly ? (
                <>
                  <textarea
                    value={workflowInput}
                    onChange={(e) => setWorkflowInput(e.target.value)}
                    placeholder='Paste workflow JSON here...'
                    rows={10}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}
                  />
                  {workflowInput.trim() !== '' && (
                    <button
                      onClick={() => setWorkflowInput('')}
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Workflow (Restore Council Config)
                    </button>
                  )}
                </>
              ) : (
                <div style={{ padding: '8px', background: '#f5f5f5', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', maxHeight: '200px', overflow: 'auto' }}>
                  {workflowInput || 'No workflow configured'}
                </div>
              )}
            </details>
          </div>

          {/* Hidden encryption controls - set showEncryption to true to enable */}
          {showEncryption && (
            <div className="config-section">
              <EncryptionControls
                conversationId={currentConversationId}
                isVisible={true}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button-modal">
            {isReadOnly ? 'Close' : 'Cancel'}
          </button>
          {!isReadOnly && (
            <button onClick={handleSave} className="save-button">
              Save Configuration
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
