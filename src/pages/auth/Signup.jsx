import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Button from '../../components/Button';
import signupImg from '../../assets/signup.png';

export default function Signup() {
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate('/dashboard');
  }

  return (
    <AuthLayout image={signupImg}>
      <h1 className="text-2xl font-bold text-ink">Sign Up to your account</h1>
      <p className="text-body mt-1 mb-8">Sign Up to start your retrofit services</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Email address</label>
          <input
            type="email"
            placeholder="John.smith@gmail.com"
            required
            className="w-full rounded-xl border border-line px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Password</label>
          <div className="relative">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Enter password"
              required
              className="w-full rounded-xl border border-line px-4 py-3.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Enter confirm password"
              required
              className="w-full rounded-xl border border-line px-4 py-3.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <Link to="#" className="block text-right text-sm italic text-ink mt-2">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="navy" className="w-full !rounded-2xl !py-4">
          Login
        </Button>
      </form>

      <p className="text-center text-sm text-body mt-8">
        Don't have an account?{' '}
        <Link to="/signup" className="font-semibold text-ink underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
