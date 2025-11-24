import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage1_5.css';

export default function Stage1_5({ interrogationData, labelToModel }) {
  const [activeTab, setActiveTab] = useState(0);
  const [expandedSections, setExpandedSections] = useState({});

  if (!interrogationData || !interrogationData.answers || interrogationData.answers.length === 0) {
    return null;
  }

  const toggleSection = (model, section) => {
    const key = `${model}-${section}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const isSectionExpanded = (model, section) => {
    const key = `${model}-${section}`;
    return expandedSections[key] ?? true; // Default to expanded
  };

  const answers = interrogationData.answers;

  // Helper to de-anonymize model names in text
  const deAnonymize = (text) => {
    if (!labelToModel) return text;
    let result = text;
    Object.entries(labelToModel).forEach(([label, modelName]) => {
      const shortName = modelName.split('/')[1] || modelName;
      result = result.replace(new RegExp(label, 'g'), `**${shortName}**`);
    });
    return result;
  };

  return (
    <div className="stage stage1-5">
      <h3 className="stage-title">Stage 1.5: Cross-Interrogation</h3>
      <p className="stage-description">
        Models question each other's responses to uncover deeper insights and unmentioned aspects.
      </p>

      <div className="tabs">
        {answers.map((answer, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {answer.model.split('/')[1] || answer.model}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {answers[activeTab] && (
          <div className="interrogation-content">
            <div className="model-name">{answers[activeTab].model}</div>

            {/* Questions Received Section */}
            <div className="section">
              <button
                className="section-header"
                onClick={() => toggleSection(answers[activeTab].model, 'questions')}
              >
                <span className="section-title">
                  📝 Questions Received ({answers[activeTab].questions?.length || 0})
                </span>
                <span className="toggle-icon">
                  {isSectionExpanded(answers[activeTab].model, 'questions') ? '▼' : '▶'}
                </span>
              </button>

              {isSectionExpanded(answers[activeTab].model, 'questions') && (
                <div className="section-content">
                  {answers[activeTab].questions && answers[activeTab].questions.length > 0 ? (
                    <div className="questions-list">
                      {answers[activeTab].questions.map((q, idx) => (
                        <div key={idx} className="question-item">
                          <div className="question-meta">
                            From: <strong>{q.from_model.split('/')[1] || q.from_model}</strong>
                          </div>
                          <div className="question-text">{q.question}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-content">No questions were asked about this response.</div>
                  )}
                </div>
              )}
            </div>

            {/* Answers Section */}
            <div className="section">
              <button
                className="section-header"
                onClick={() => toggleSection(answers[activeTab].model, 'answers')}
              >
                <span className="section-title">💬 Answers Provided</span>
                <span className="toggle-icon">
                  {isSectionExpanded(answers[activeTab].model, 'answers') ? '▼' : '▶'}
                </span>
              </button>

              {isSectionExpanded(answers[activeTab].model, 'answers') && (
                <div className="section-content">
                  {answers[activeTab].answers ? (
                    <div className="answers-text markdown-content">
                      <ReactMarkdown>{answers[activeTab].answers}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="no-content">No answers provided.</div>
                  )}
                </div>
              )}
            </div>

            {/* Original Response Reference (collapsed by default) */}
            <div className="section">
              <button
                className="section-header"
                onClick={() => toggleSection(answers[activeTab].model, 'original')}
              >
                <span className="section-title">📄 Original Response (Reference)</span>
                <span className="toggle-icon">
                  {isSectionExpanded(answers[activeTab].model, 'original') ? '▼' : '▶'}
                </span>
              </button>

              {isSectionExpanded(answers[activeTab].model, 'original') && (
                <div className="section-content">
                  <div className="original-response markdown-content">
                    <ReactMarkdown>{answers[activeTab].original_response}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
