import { modelsToOptions, getDefaultModels } from '../utils/defaultModels.js';

/**
 * Reusable model dropdown with user/default separation
 *
 * Displays user's custom models first in a separate optgroup,
 * followed by default models in another optgroup.
 */
function ModelSelect({
  value,
  onChange,
  globalModels,
  label = 'Model',
  required = false,
  className = ''
}) {
  // Convert globalModels to dropdown options format
  const options = globalModels ? modelsToOptions(globalModels) : modelsToOptions(getDefaultModels());

  // Separate user models from defaults
  const userModels = options.filter(opt => !opt.isDefault);
  const defaultModels = options.filter(opt => opt.isDefault);

  return (
    <div className={`form-group ${className}`}>
      <label>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      >
        {/* Show placeholder if no value selected */}
        {!value && <option value="">Select a model...</option>}

        {/* User models first (if any) */}
        {userModels.length > 0 && (
          <optgroup label="Your Custom Models">
            {userModels.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        )}

        {/* Default models */}
        <optgroup label="Default Models">
          {defaultModels.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

export default ModelSelect;
