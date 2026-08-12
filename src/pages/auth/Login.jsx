import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import AuthLayout from './AuthLayout';
import Button from '../../components/Button';
import { useProfile } from '../../context/ProfileContext';
import loginImg from '../../assets/login.png';

export default function Login() {
  const [role, setRole] = useState('client');
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const { updateProfile } = useProfile();

  function handleSubmit(e) {
    e.preventDefault();
    if (email) updateProfile({ email });
    navigate(role === 'admin' ? '/admin/dashboard' : '/dashboard');
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Email address</label>
          <input
            type="email"
            placeholder="John.smith@gmail.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <Link to="#" className="block text-sm italic text-ink mt-2">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="navy" className="w-full !rounded-2xl !py-4">
          Login
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
