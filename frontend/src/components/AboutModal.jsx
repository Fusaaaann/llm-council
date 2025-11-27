import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './AboutModal.css';

function AboutModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchAboutContent();
    }
  }, [isOpen]);

  const fetchAboutContent = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/docs/about.md');
      if (!response.ok) {
        throw new Error('Failed to load about content');
      }
      const text = await response.text();
      setContent(text);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="about-modal-overlay" onClick={onClose}>
      <div className="about-modal" onClick={(e) => e.stopPropagation()}>
        <button className="about-modal-close" onClick={onClose}>×</button>

        {isLoading ? (
          <div className="about-loading">Loading...</div>
        ) : error ? (
          <div className="about-error">
            <h2>Error</h2>
            <p>{error}</p>
          </div>
        ) : (
          <div className="about-content markdown-content">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        <div className="about-footer">
          <button onClick={onClose} className="about-close-btn">Got it</button>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
