import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Button from '../../components/Button';
import { useProfile } from '../../context/ProfileContext';
import { useToast } from '../../context/ToastContext';
import loginImg from '../../assets/login.png';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;
const SUBMIT_DELAY_MS = 800;

function validateLogin({ email, password }) {
  const errors = {};
  if (!email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < PASSWORD_MIN) {
    errors.password = `Password must be at least ${PASSWORD_MIN} characters`;
  }
  return errors;
}

export default function Login() {
  const [role, setRole] = useState('client');
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { updateProfile } = useProfile();
  const { showToast } = useToast();

  const isInvalid = Object.keys(validateLogin({ email, password })).length > 0;

  function handleChange(field, value) {
    const next = { email, password, [field]: value };
    setEmail(next.email);
    setPassword(next.password);
    setErrors(validateLogin(next));
  }

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function showError(field) {
    return Boolean(errors[field] && (submitted || touched[field]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validateLogin({ email, password });
    setErrors(errs);
    setSubmitted(true);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      if (email.trim().toLowerCase().includes('fail')) {
        showToast({ type: 'error', message: 'Invalid email or password. Please try again.' });
        return;
      }
      updateProfile({ email: email.trim() });
      showToast({ type: 'success', message: 'Logged in successfully' });
      navigate(role === 'admin' ? '/admin/dashboard' : '/dashboard');
    }, SUBMIT_DELAY_MS);
  }

  return (
    <AuthLayout image={loginImg}>
      <h1 className="auth-title">
        Login to your account
      </h1>
      <p className="text-body mt-1 mb-6">The faster you login, The faster we get to work</p>

      <div className="flex gap-2 mb-6 bg-surface rounded-xl p-1">
        {['client', 'admin'].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              role === r ? 'bg-white shadow text-ink' : 'text-muted'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="login-email" className="block text-sm font-semibold text-ink mb-2">
            Email address <span className="form-required">*</span>
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="John.smith@gmail.com"
            value={email}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            aria-invalid={showError('email')}
            className={`form-input ${showError('email') ? 'form-input-error' : ''}`}
          />
          {showError('email') && <p className="form-error-text">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-semibold text-ink mb-2">
            Password <span className="form-required">*</span>
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              aria-invalid={showError('password')}
              className={`form-input form-input--password ${showError('password') ? 'form-input-error' : ''}`}
            />
            <button
              type="button"
              aria-label={showPass ? 'Hide password' : 'Show password'}
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {showError('password') && <p className="form-error-text">{errors.password}</p>}
          <Link to="#" className="block text-sm italic text-ink mt-2">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="navy"
          disabled={isInvalid || isSubmitting}
          className="w-full !rounded-2xl !py-4"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Logging in...
            </>
          ) : (
            'Login'
          )}
        </Button>
      </form>

      <p className="text-sm text-body mt-8 text-left">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-ink underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
