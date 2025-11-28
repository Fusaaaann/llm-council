import { useState, useEffect } from 'react';
import './AuthModal.css';
import { api } from '../api';

function AuthModal({ isOpen, onClose, onSuccess, inviteToken = null }) {
  const [mode, setMode] = useState('login'); // 'login', 'register', or 'waitlist'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [inviteEmail, setInviteEmail] = useState(null);

  // If invite token provided, validate it on mount
  useEffect(() => {
    if (inviteToken && isOpen) {
      validateInviteToken();
    }
  }, [inviteToken, isOpen]);

  const validateInviteToken = async () => {
    try {
      const data = await api.validateInviteToken(inviteToken);
      setMode('register');
      if (data.email) {
        setInviteEmail(data.email);
        setEmail(data.email);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'waitlist') {
        // Handle waitlist submission
        await api.joinWaitlist(email, name);
        setWaitlistSuccess(true);
        setEmail('');
        setName('');
      } else if (mode === 'register') {
        if (!name.trim()) {
          setError('Name is required');
          setIsLoading(false);
          return;
        }
        await onSuccess('register', { email, password, name, invite_token: inviteToken });
      } else {
        await onSuccess('login', { email, password });
      }

      // Clear form (except for waitlist success)
      if (mode !== 'waitlist') {
        setEmail('');
        setPassword('');
        setName('');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    if (mode === 'login') {
      setMode('waitlist');
    } else if (mode === 'waitlist') {
      setMode('login');
    } else {
      setMode('login');
    }
    setError('');
    setWaitlistSuccess(false);
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>×</button>

        <h2>
          {mode === 'login' ? 'Log In' : mode === 'waitlist' ? 'Join Waitlist' : 'Create Account'}
        </h2>

        {inviteToken && mode === 'register' && (
          <div className="invite-notice">
            {inviteEmail ? (
              <p>You've been invited! Complete registration for <strong>{inviteEmail}</strong></p>
            ) : (
              <p>You've been invited! Complete your registration below.</p>
            )}
          </div>
        )}

        {waitlistSuccess ? (
          <div className="waitlist-success">
            <p>✓ You've been added to the waitlist!</p>
            <p>We'll send you an invite link when a spot becomes available.</p>
            <button onClick={onClose} className="auth-submit-btn">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {(mode === 'register' || mode === 'waitlist') && (
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={inviteEmail !== null}
              />
            </div>

            {mode !== 'waitlist' && (
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength="6"
                />
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? 'Please wait...' : (
                mode === 'login' ? 'Log In' :
                mode === 'waitlist' ? 'Join Waitlist' :
                'Register'
              )}
            </button>
          </form>
        )}

        {!waitlistSuccess && (
          <div className="auth-toggle">
            {mode === 'login' ? (
              <>
                Don't have an account?{' '}
                <button onClick={toggleMode} className="auth-toggle-btn">
                  Join Waitlist
                </button>
              </>
            ) : mode === 'waitlist' ? (
              <>
                Already have an account?{' '}
                <button onClick={toggleMode} className="auth-toggle-btn">
                  Log In
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button onClick={toggleMode} className="auth-toggle-btn">
                  Log In
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
