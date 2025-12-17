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
import ModelSelect from '../components/ModelSelect.jsx';

function Step3Perspectives({ state, onChange, onNext, onBack }) {
  const [showPresets, setShowPresets] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(PRESET_CATEGORIES.GENERAL);
  const [errors, setErrors] = useState({});
  const [modelBound, setModelBound] = useState(state.modelBound || false);

  const perspectives = state.perspectives || [];
  const globalModels = state.globalModels || [];

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
      const newPerspective = {
        ...createPerspectiveFromPreset(preset.id),
        modelBound: modelBound,  // Inherit global model binding setting
        model: modelBound ? (preset.model || models.GPT4) : null  // Only set model if bound
      };
      onChange({ perspectives: [...perspectives, newPerspective] });
    } else {
      const newPerspective = {
        id: `perspective_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: '',
        role: '',
        modelBound: modelBound,  // Inherit global model binding setting
        model: modelBound ? models.GPT4 : null  // Only set model if bound
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

    // If switching to model-neutral, clear model binding
    if (field === 'modelBound' && !value) {
      updated[index].model = null;
    }

    onChange({ perspectives: updated });
  };

  const handleModelBoundChange = (value) => {
    setModelBound(value);

    // Update all existing perspectives
    const updated = perspectives.map(p => ({
      ...p,
      modelBound: value,
      model: value ? (p.model || models.GPT4) : null
    }));

    onChange({
      modelBound: value,
      perspectives: updated
    });
  };

  const loadRecommendedCombination = (combination) => {
    const newPerspectives = combination.presets.map(presetId => {
      const preset = PERSPECTIVE_PRESETS.find(p => p.id === presetId);
      return {
        ...createPerspectiveFromPreset(preset.id),
        modelBound: modelBound,
        model: modelBound ? (preset.model || models.GPT4) : null
      };
    });
    onChange({ perspectives: newPerspectives });
    setShowPresets(false);
  };

  return (
    <div className="wizard-step step-perspectives">
      <div className="step-header">
        <h2>Step 3: Choose Delegates & Perspectives</h2>
        <p className="step-description">
          Choose the AI perspectives that will analyze the problem.
        </p>
      </div>

      <div className="step-content">
        {/* Q2.3: Model Binding Toggle */}
        <div className="question-card">
          <div className="question-header">
            <h3>Model Selection</h3>
            <span className="required-badge">Required</span>
          </div>
          <p className="question-description">
            Choose whether all models analyze each perspective, or bind specific models.
          </p>

          <div className="radio-group">
            <label className={!modelBound ? 'active' : ''}>
              <input
                type="radio"
                name="modelBound"
                checked={!modelBound}
                onChange={() => handleModelBoundChange(false)}
              />
              <div className="radio-content">
                <strong>All models (Recommended)</strong>
                <p className="radio-description">
                  {globalModels.length} × {perspectives.length || 0} = {globalModels.length * (perspectives.length || 0)} analyses
                </p>
                <div className="benefit-badge">✓ Maximum diversity</div>
              </div>
            </label>

            <label className={modelBound ? 'active' : ''}>
              <input
                type="radio"
                name="modelBound"
                checked={modelBound}
                onChange={() => handleModelBoundChange(true)}
              />
              <div className="radio-content">
                <strong>Bind specific models</strong>
                <p className="radio-description">
                  Control which model analyzes each perspective
                </p>
                <div className="benefit-badge">✓ Precise control</div>
              </div>
            </label>
          </div>

          {errors.modelBinding && (
            <span className="error-message">{errors.modelBinding}</span>
          )}
        </div>

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
                    <span className="preset-model">
                      {(state.globalModels || []).find(m => m.modelRef === preset.model)?.label || preset.model}
                    </span>
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

                  {/* Model selector - ONLY show if modelBound=true
                      DSL Mapping:
                      - modelBound=true + model='openai/gpt-4o' → { ..., model_ref: 'openai/gpt-4o' }
                      - modelBound=false + model=null → { ... } (NO model_ref, all models analyze)
                  */}
                  {modelBound ? (
                    <ModelSelect
                      value={perspective.model}
                      onChange={(modelRef) => {
                        updatePerspective(index, 'modelBound', true);
                        updatePerspective(index, 'model', modelRef);
                      }}
                      globalModels={state.globalModels}
                      label="Model *"
                    />
                  ) : (
                    <div className="form-group">
                      <label>Model</label>
                      <div className="model-neutral-badge">
                        <span className="badge-icon">🌐</span>
                        <div className="badge-content">
                          <strong>All models ({globalModels.length})</strong>
                          <p className="badge-hint">
                            Models: {globalModels.map(m => m.label || m.modelRef).join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                      How this perspective approaches the problem.
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
          <strong>💡 Tip:</strong> Use complementary perspectives with diverse viewpoints.
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
