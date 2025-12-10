import { useState, useEffect } from 'react';
import { api } from '../api';
import './EncryptionControls.css';

export default function EncryptionControls({ conversationId, isVisible = false }) {
  const [encryptionStatus, setEncryptionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (conversationId) {
      loadEncryptionStatus();
    }
  }, [conversationId]);

  const loadEncryptionStatus = async () => {
    try {
      const status = await api.getEncryptionStatus(conversationId);
      setEncryptionStatus(status);
      setError(null);
    } catch (err) {
      console.error('Failed to load encryption status:', err);
      setError('Failed to load encryption status');
    }
  };

  const handleEncrypt = async () => {
    if (!confirm('Encrypt this conversation? Messages will be encrypted at rest.')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.encryptConversation(conversationId);
      setEncryptionStatus(result.status);
      alert(result.message);
    } catch (err) {
      console.error('Failed to encrypt conversation:', err);
      setError('Failed to encrypt conversation');
      alert('Failed to encrypt conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async () => {
    if (!confirm('Decrypt this conversation? Messages will be stored in plaintext.')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.decryptConversation(conversationId);
      setEncryptionStatus(result.status);
      alert(result.message);
    } catch (err) {
      console.error('Failed to decrypt conversation:', err);
      setError('Failed to decrypt conversation');
      alert('Failed to decrypt conversation');
    } finally {
      setLoading(false);
    }
  };

  // Hide component if not visible
  if (!isVisible || !conversationId) {
    return null;
  }

  return (
    <div className="encryption-controls">
      <div className="encryption-status">
        <h3>🔐 Encryption Status</h3>
        {encryptionStatus && (
          <div className="status-details">
            <div className="status-item">
              <span className="status-label">Status:</span>
              <span className={`status-value ${encryptionStatus.is_encrypted ? 'encrypted' : 'plaintext'}`}>
                {encryptionStatus.is_encrypted ? '🔒 Encrypted' : '🔓 Plaintext'}
              </span>
            </div>
            {encryptionStatus.is_encrypted && (
              <>
                <div className="status-item">
                  <span className="status-label">Provider:</span>
                  <span className="status-value">{encryptionStatus.provider}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Version:</span>
                  <span className="status-value">{encryptionStatus.version}</span>
                </div>
              </>
            )}
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
      </div>

      <div className="encryption-actions">
        {encryptionStatus && !encryptionStatus.is_encrypted && (
          <button
            onClick={handleEncrypt}
            disabled={loading}
            className="encrypt-button"
          >
            {loading ? 'Encrypting...' : '🔒 Encrypt Conversation'}
          </button>
        )}
        {encryptionStatus && encryptionStatus.is_encrypted && (
          <button
            onClick={handleDecrypt}
            disabled={loading}
            className="decrypt-button"
          >
            {loading ? 'Decrypting...' : '🔓 Decrypt Conversation'}
          </button>
        )}
      </div>

      <div className="encryption-info">
        <p className="info-text">
          ℹ️ Encryption protects message content at rest. Metadata (title, timestamps) remains unencrypted.
        </p>
      </div>
    </div>
  );
}
