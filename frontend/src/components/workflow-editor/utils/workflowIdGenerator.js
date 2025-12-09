/**
 * Workflow ID Generator
 * Auto-generates workflow IDs from problem statements
 */

/**
 * Generate a simple hash from a string
 * @param {string} str - Input string
 * @returns {string} 4-character hash
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).slice(0, 4);
}

/**
 * Slugify a string for use as a workflow ID
 * @param {string} text - Input text
 * @param {number} maxLength - Maximum length (default: 40)
 * @returns {string} Slugified string
 */
function slugify(text, maxLength = 40) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/[^\w\-]+/g, '')       // Remove non-word chars except hyphens
    .replace(/\_\_+/g, '_')         // Replace multiple underscores with single
    .replace(/^_+/, '')             // Trim underscores from start
    .replace(/_+$/, '')             // Trim underscores from end
    .slice(0, maxLength);           // Truncate to max length
}

/**
 * Generate a unique workflow ID from a problem statement
 * @param {string} problemStatement - The workflow's problem statement
 * @returns {string} Generated workflow ID (e.g., "should_we_migrate_to_mongodb_a3f2")
 */
export function generateWorkflowId(problemStatement) {
  // If empty, return a UUID-like fallback
  if (!problemStatement || problemStatement.trim() === '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `workflow_${timestamp}_${random}`;
  }

  // Slugify the problem statement
  const slug = slugify(problemStatement, 40);

  // Add a short hash for uniqueness
  const hash = simpleHash(problemStatement + Date.now());

  // Combine: slug + hash
  return `${slug}_${hash}`;
}

/**
 * Validate a workflow ID
 * @param {string} id - Workflow ID to validate
 * @returns {boolean} True if valid
 */
export function isValidWorkflowId(id) {
  if (!id || typeof id !== 'string') return false;

  // Must be lowercase alphanumeric with underscores/hyphens
  // Must start with a letter or number
  const pattern = /^[a-z0-9][a-z0-9_-]*$/;
  return pattern.test(id) && id.length >= 3 && id.length <= 64;
}

/**
 * Sanitize a user-provided workflow ID
 * @param {string} id - User input
 * @returns {string} Sanitized ID
 */
export function sanitizeWorkflowId(id) {
  if (!id) return '';
  return slugify(id, 64);
}
