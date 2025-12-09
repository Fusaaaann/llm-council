import { useState } from 'react';
import { models } from '../../../workflowGenerator.js';
import {
  PERSPECTIVE_PRESETS,
  PRESET_CATEGORIES,
  getAllCategories,
  getPresetsByCategory,
  createPerspectiveFromPreset,
  getRecommendedCombinations
} from '../utils/perspectivePresets.js';

const MODEL_OPTIONS = [
  { value: models.GPT4, label: 'GPT-4' },
  { value: models.GPT4_TURBO, label: 'GPT-4 Turbo' },
  { value: models.CLAUDE_SONNET, label: 'Claude Sonnet' },
  { value: models.GEMINI_FLASH, label: 'Gemini Flash' }
];

function Step3Perspectives({ state, onChange, onNext, onBack }) {
  const [showPresets, setShowPresets] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(PRESET_CATEGORIES.GENERAL);
  const [errors, setErrors] = useState({});

  const perspectives = state.perspectives || [];

  const validate = () => {
    const newErrors = {};

    if (perspectives.length === 0) {
      newErrors.perspectives = 'At least one perspective is required';
    }

    perspectives.forEach((p, idx) => {
      if (!p.name || p.name.trim() === '') {
        newErrors[`name_${idx}`] = 'Name is required';
      }
      if (!p.role || p.role.trim() === '') {
        newErrors[`role_${idx}`] = 'Role definition is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validate()) {
      onNext();
    }
  };

  const addPerspective = (preset = null) => {
    if (preset) {
      const newPerspective = createPerspectiveFromPreset(preset.id);
      onChange({ perspectives: [...perspectives, newPerspective] });
    } else {
      const newPerspective = {
        id: `perspective_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        role: '',
        model: models.GPT4
      };
      onChange({ perspectives: [...perspectives, newPerspective] });
      setShowPresets(false);
    }
  };

  const removePerspective = (index) => {
    onChange({ perspectives: perspectives.filter((_, i) => i !== index) });
  };

  const updatePerspective = (index, field, value) => {
    const updated = [...perspectives];
    updated[index][field] = value;
    onChange({ perspectives: updated });
  };

  const loadRecommendedCombination = (combination) => {
    const newPerspectives = combination.presets.map(presetId => {
      const preset = PERSPECTIVE_PRESETS.find(p => p.id === presetId);
      return createPerspectiveFromPreset(preset.id);
    });
    onChange({ perspectives: newPerspectives });
    setShowPresets(false);
  };

  return (
    <div className="wizard-step step-perspectives">
      <div className="step-header">
        <h2>Step 3: Choose Delegates & Perspectives</h2>
        <p className="step-description">
          Set up the AI delegates you want to "hire" for this workflow. Each delegate is a specialized perspective that proposes its own answer.
        </p>
      </div>

      <div className="step-content">
        {/* Recommended Combinations */}
        {perspectives.length === 0 && (
          <div className="recommended-combinations">
            <h3>Quick Start: Recommended Delegate Sets</h3>
            <div className="combination-grid">
              {getRecommendedCombinations().map((combo, idx) => (
                <div key={idx} className="combination-card" onClick={() => loadRecommendedCombination(combo)}>
                  <h4>{combo.name}</h4>
                  <p>{combo.description}</p>
                  <span className="combination-count">{combo.presets.length} perspectives</span>
                </div>
              ))}
            </div>
            <div className="divider">OR</div>
          </div>
        )}

        {/* Add Perspective Controls */}
        <div className="add-perspective-controls">
          <button onClick={() => addPerspective()} className="btn-primary">
            + Add Custom Delegate
          </button>
          <button onClick={() => setShowPresets(!showPresets)} className="btn-secondary">
            {showPresets ? 'Hide Presets' : 'Show Presets'}
          </button>
        </div>

        {/* Preset Library */}
        {showPresets && (
          <div className="preset-library">
            <h3>Delegate Preset Library</h3>
            <div className="preset-categories">
              {getAllCategories().map(category => (
                <button
                  key={category}
                  className={selectedCategory === category ? 'active' : ''}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className="preset-list">
              {getPresetsByCategory(selectedCategory).map(preset => (
                <div key={preset.id} className="preset-card">
                  <div className="preset-info">
                    <h4>{preset.name}</h4>
                    <p>{preset.role}</p>
                    <span className="preset-model">{MODEL_OPTIONS.find(m => m.value === preset.model)?.label}</span>
                  </div>
                  <button onClick={() => addPerspective(preset)} className="btn-add">
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Perspectives */}
        {perspectives.length > 0 && (
          <div className="selected-perspectives">
            <h3>Your Delegates & Perspectives ({perspectives.length})</h3>
            {errors.perspectives && (
              <span className="error-message">{errors.perspectives}</span>
            )}

            {perspectives.map((perspective, index) => (
              <div key={perspective.id} className="perspective-item">
                <div className="perspective-header">
                  <h4>Perspective {index + 1}</h4>
                  <button onClick={() => removePerspective(index)} className="btn-remove">
                    Remove
                  </button>
                </div>

                <div className="perspective-fields">
                  <div className="form-group">
                    <label>Delegate Name *</label>
                    <input
                      type="text"
                      value={perspective.name}
                      onChange={(e) => updatePerspective(index, 'name', e.target.value)}
                      placeholder="e.g., Optimist, Security Expert, CFO"
                      className={errors[`name_${index}`] ? 'error' : ''}
                    />
                    {errors[`name_${index}`] && (
                      <span className="error-message">{errors[`name_${index}`]}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Model</label>
                    <select
                      value={perspective.model}
                      onChange={(e) => updatePerspective(index, 'model', e.target.value)}
                    >
                      {MODEL_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Delegate Instructions (Role & Focus) *</label>
                    <textarea
                      value={perspective.role}
                      onChange={(e) => updatePerspective(index, 'role', e.target.value)}
                      placeholder="Describe what this delegate should focus on (e.g., risks, user impact, costs, legal constraints)..."
                      rows={3}
                      className={errors[`role_${index}`] ? 'error' : ''}
                    />
                    <span className="help-text">
                      This becomes the role definition for a worker in the workflow (how this delegate thinks about the problem).
                    </span>
                    {errors[`role_${index}`] && (
                      <span className="error-message">{errors[`role_${index}`]}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="info-box">
          <strong>💡 Tip:</strong> Good delegate setups are:
          <ul>
            <li><strong>Complementary:</strong> Each delegate adds something unique (e.g., risk, upside, feasibility)</li>
            <li><strong>Balanced:</strong> Include opposing views (pros/cons, technical/business)</li>
            <li><strong>Relevant:</strong> Match delegates to your actual decision (e.g., legal, finance, security)</li>
          </ul>
        </div>
      </div>

      <div className="step-actions">
        <button onClick={onBack} className="btn-secondary">
          ← Back
        </button>
        <button onClick={handleNext} className="btn-primary">
          Next: How to Collect & Decide →
        </button>
      </div>
    </div>
  );
}

export default Step3Perspectives;
