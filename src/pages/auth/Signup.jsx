import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Button from '../../components/Button';
import { useToast } from '../../context/ToastContext';
import signupImg from '../../assets/signup.png';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 6;
const SUBMIT_DELAY_MS = 800;

function validateSignup({ email, password, confirmPassword }) {
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
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords do not match';
  }
  return errors;
}

export default function Signup() {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isInvalid = Object.keys(validateSignup({ email, password, confirmPassword })).length > 0;

  function handleChange(field, value) {
    const next = { email, password, confirmPassword, [field]: value };
    setEmail(next.email);
    setPassword(next.password);
    setConfirmPassword(next.confirmPassword);
    setErrors(validateSignup(next));
  }

  function handleBlur(field) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function showError(field) {
    return Boolean(errors[field] && (submitted || touched[field]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validateSignup({ email, password, confirmPassword });
    setErrors(errs);
    setSubmitted(true);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    window.setTimeout(() => {
      setIsSubmitting(false);
      if (email.trim().toLowerCase().includes('fail')) {
        showToast({ type: 'error', message: 'Could not create account. Please try again.' });
        return;
      }
      showToast({ type: 'success', message: 'Account created successfully' });
      navigate('/dashboard');
    }, SUBMIT_DELAY_MS);
  }

  return (
    <AuthLayout image={signupImg}>
      <h1 className="auth-title">
        Sign Up to your account
      </h1>
      <p className="text-body mt-1 mb-8">Sign Up to start your retrofit services</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="signup-email" className="block text-sm font-semibold text-ink mb-2">
            Email address <span className="form-required">*</span>
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className="block text-sm font-semibold text-ink mb-2">
            Password <span className="form-required">*</span>
          </label>
          <div className="relative">
            <input
              id="signup-password"
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
        </div>
        <div>
          <label htmlFor="signup-confirm-password" className="block text-sm font-semibold text-ink mb-2">
            Confirm Password <span className="form-required">*</span>
          </label>
          <div className="relative">
            <input
              id="signup-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Enter confirm password"
              value={confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              aria-invalid={showError('confirmPassword')}
              className={`form-input form-input--password ${showError('confirmPassword') ? 'form-input-error' : ''}`}
            />
            <button
              type="button"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {showError('confirmPassword') && <p className="form-error-text">{errors.confirmPassword}</p>}
        </div>

        <Button
          type="submit"
          variant="navy"
          disabled={isInvalid || isSubmitting}
          className="w-full !rounded-2xl !py-4 auth-submit-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating account...
            </>
          ) : (
            'Sign Up'
          )}
        </Button>
      </form>

      <p className="text-sm text-body mt-8 text-left">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-ink underline">
          Login
        </Link>
      </p>
    </AuthLayout>
  );
}
