import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { isPrimitive, formatKeyAsHeader } from '../utils/messageDetection';
import './StructuredDataDisplay.css';

/**
 * Schema-Neutral Structured Data Display
 *
 * Renders JSON data (objects, arrays, primitives) using recursive type-based rendering.
 * NO pattern matching - works with ANY schema structure.
 */

/**
 * Main wrapper component
 */
function StructuredDataDisplay({ data, theme = 'purple', maxDepth = 3, showRawToggle = true }) {
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className={`structured-data-container ${theme}-theme`}>
      <StructuredValue value={data} depth={0} maxDepth={maxDepth} theme={theme} />

      {showRawToggle && (
        <div className="structured-data-raw-toggle">
          <button
            className="structured-data-raw-toggle-btn"
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Hide Raw JSON' : 'View Raw JSON'}
          </button>
          {showRaw && (
            <pre className="structured-data-raw-content">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Recursive value renderer - core of schema-neutral rendering
 */
function StructuredValue({ value, depth, maxDepth, theme }) {
  // Depth limit - prevent infinite recursion
  if (depth > maxDepth) {
    return (
      <div className="structured-data-depth-exceeded">
        <pre className="json-content">{JSON.stringify(value, null, 2)}</pre>
      </div>
    );
  }

  // Null/undefined
  if (value === null || value === undefined) {
    return <span className="structured-data-null">(no value)</span>;
  }

  // Primitives: string, number, boolean
  if (isPrimitive(value)) {
    if (typeof value === 'string') {
      return <MarkdownText content={value} />;
    }
    return <span className="structured-data-primitive">{String(value)}</span>;
  }

  // Arrays
  if (Array.isArray(value)) {
    return <ArrayRenderer items={value} depth={depth} maxDepth={maxDepth} theme={theme} />;
  }

  // Objects
  if (typeof value === 'object') {
    return <ObjectRenderer obj={value} depth={depth} maxDepth={maxDepth} theme={theme} />;
  }

  // Fallback (should rarely happen)
  return <pre className="json-content">{JSON.stringify(value, null, 2)}</pre>;
}

/**
 * Array renderer - renders arrays as lists
 */
function ArrayRenderer({ items, depth, maxDepth, theme }) {
  if (items.length === 0) {
    return <span className="structured-data-empty">(empty list)</span>;
  }

  // Check if all items are primitives
  const allPrimitives = items.every(item => isPrimitive(item));

  // Check if all items are numbers (for numbered lists)
  const allNumbers = items.every(item => typeof item === 'number');

  if (allPrimitives) {
    // Render as bulleted or numbered list
    const ListTag = allNumbers ? 'ol' : 'ul';
    return (
      <ListTag className="structured-data-list">
        {items.map((item, index) => (
          <li key={index} className="structured-data-list-item">
            <StructuredValue
              value={item}
              depth={depth + 1}
              maxDepth={maxDepth}
              theme={theme}
            />
          </li>
        ))}
      </ListTag>
    );
  }

  // For arrays of objects/arrays, render each as a card
  return (
    <div className="structured-data-array-items">
      {items.map((item, index) => (
        <div key={index} className="structured-data-array-item-card">
          <div className="structured-data-array-item-header">Item {index + 1}</div>
          <div className="structured-data-array-item-content">
            <StructuredValue
              value={item}
              depth={depth + 1}
              maxDepth={maxDepth}
              theme={theme}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Object renderer - renders objects as sections with headers
 */
function ObjectRenderer({ obj, depth, maxDepth, theme }) {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return <span className="structured-data-empty">(empty object)</span>;
  }

  return (
    <div className="structured-data-object">
      {entries.map(([key, value], index) => (
        <div key={index} className={`structured-data-section depth-${depth}`}>
          <div className="structured-data-header">
            {formatKeyAsHeader(key)}
          </div>
          <div className="structured-data-content">
            <StructuredValue
              value={value}
              depth={depth + 1}
              maxDepth={maxDepth}
              theme={theme}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Markdown text renderer - wraps ReactMarkdown with proper styling
 */
function MarkdownText({ content }) {
  // Handle empty strings
  if (!content || content.trim() === '') {
    return <span className="structured-data-empty">(empty)</span>;
  }

  // Check if content is very long (>1000 chars)
  const isLong = content.length > 1000;
  const [expanded, setExpanded] = useState(false);

  if (isLong && !expanded) {
    const truncated = content.substring(0, 1000) + '...';
    return (
      <div className="markdown-content">
        <ReactMarkdown>{truncated}</ReactMarkdown>
        <button
          className="structured-data-expand-btn"
          onClick={() => setExpanded(true)}
        >
          Show more
        </button>
      </div>
    );
  }

  return (
    <div className="markdown-content">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export default StructuredDataDisplay;
