/**
 * QuestionCard - Reusable component for wizard questions
 * Provides consistent styling for question-based UI
 */

function QuestionCard({
  question,
  description,
  required = false,
  error = null,
  children
}) {
  return (
    <div className="question-card">
      <div className="question-header">
        <h4 className="question-text">
          {question}
          {required && <span className="required-indicator">*</span>}
        </h4>
        {description && (
          <p className="question-description">{description}</p>
        )}
      </div>

      <div className="question-content">
        {children}
      </div>

      {error && (
        <div className="question-error">
          <span className="error-icon">⚠</span>
          <span className="error-message">{error}</span>
        </div>
      )}
    </div>
  );
}

export default QuestionCard;
