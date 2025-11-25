import { useState, useEffect } from 'react';
import './ModelConfig.css';

export default function ModelConfig({ isOpen, onClose, onSave }) {
  const [councilModels, setCouncilModels] = useState([]);
  const [chairmanModel, setChairmanModel] = useState('');
  const [newModel, setNewModel] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen]);

  const loadCurrentConfig = async () => {
    try {
      const response = await fetch('http://localhost:8001/api/models');
      const data = await response.json();
      setCouncilModels(data.council_models);
      setChairmanModel(data.chairman_model);
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
    if (councilModels.length === 0) {
      alert('Please add at least one council model');
      return;
    }
    if (!chairmanModel.trim()) {
      alert('Please select a chairman model');
      return;
    }

    try {
      await onSave(councilModels, chairmanModel);
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
          <div className="config-section">
            <h3>Council Members</h3>
            <p className="help-text">
              Models that will provide individual responses and peer reviews
            </p>
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
              />
              <button onClick={handleAddModel} className="add-button">
                + Add
              </button>
            </div>
            <div className="model-list">
              {councilModels.length === 0 ? (
                <div className="empty-list">No council models configured</div>
              ) : (
                councilModels.map((model) => (
                  <div key={model} className="model-item">
                    <span>{model}</span>
                    <button
                      onClick={() => handleRemoveModel(model)}
                      className="remove-button"
                    >
                      ✕
                    </button>
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
            <select
              value={chairmanModel}
              onChange={(e) => setChairmanModel(e.target.value)}
              className="chairman-select"
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
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button-modal">
            Cancel
          </button>
          <button onClick={handleSave} className="save-button">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
