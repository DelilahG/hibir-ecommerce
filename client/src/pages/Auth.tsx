import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Field, Notice } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ApiError, errorMessage } from '../lib/api';

/** Only allow redirects to paths within this site. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account';
}

export function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={next} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  const fieldErr = (p: string) => (error instanceof ApiError ? error.fieldMessage(p) : undefined);
  const generalErr = error && !(error instanceof ApiError && error.fields.length) ? errorMessage(error) : '';
  const other = mode === 'login' ? 'register' : 'login';
  const nextQuery = params.get('next') ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <div className="container page auth-page">
      <div className="auth-card">
        <h1 className="page-title">{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
        <p className="page-lede">
          {mode === 'login' ? 'Use your email and password to see orders and check out.' : 'An account keeps your bag and order history in one place.'}
        </p>
        {generalErr && <Notice tone="error">{generalErr}</Notice>}
        <form onSubmit={onSubmit} className="stack" noValidate>
          {mode === 'register' && (
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} error={fieldErr('name')} />
          )}
          <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} error={fieldErr('email')} />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 10 : undefined}
            maxLength={200}
            hint={mode === 'register' ? 'At least 10 characters' : undefined}
            error={fieldErr('password')}
          />
          <button type="submit" className="btn btn-dark btn-block" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <Link to={`/${other}${nextQuery}`} className="text-link">
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
