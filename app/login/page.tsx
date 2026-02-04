'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/lib/auth';
import { Zap, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isAuthenticated } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  if (isAuthenticated) {
    router.push('/account');
    return null;
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (mode === 'forgot') {
      setIsSubmitting(true);
      try {
        const res = await fetch(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        if (res.ok) {
          setResetSent(true);
        } else {
          setError('Failed to send reset email. Please try again.');
        }
      } catch {
        setError('Failed to send reset email. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Please enter your password');
      return;
    }

    if (mode === 'register') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password);
      }
      router.push('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Zap className="w-10 h-10 text-orange-500" />
            <span className="font-bold text-2xl text-gray-900">Thunderbird</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-center text-zinc-900 mb-2">
            {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset password'}
          </h1>
          <p className="text-zinc-500 text-center text-sm mb-6">
            {mode === 'login'
              ? 'Sign in to manage your routes and forecasts'
              : mode === 'register'
              ? 'Get started with Thunderbird'
              : 'Enter your email to receive a reset link'}
          </p>

          {/* Reset email sent success */}
          {resetSent && mode === 'forgot' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-medium text-zinc-900 mb-2">Check your email</h2>
              <p className="text-zinc-500 text-sm mb-6">
                If an account exists for {email}, you&apos;ll receive a password reset link.
              </p>
              <button
                onClick={() => { setMode('login'); setResetSent(false); setEmail(''); }}
                className="text-orange-600 hover:text-orange-700 font-medium text-sm"
              >
                Back to sign in
              </button>
            </div>
          )}

          {/* Error message */}
          {error && !resetSent && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {!resetSent && <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password (hidden in forgot mode) */}
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder={mode === 'register' ? 'Min. 8 characters' : 'Enter password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirm Password (register only) */}
            {mode === 'register' && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {/* Forgot password link (login mode only) */}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); }}
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-orange py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting
                ? (mode === 'login' ? 'Signing in...' : mode === 'register' ? 'Creating account...' : 'Sending...')
                : (mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link')}
            </button>
          </form>}

          {/* Toggle mode */}
          {!resetSent && (
            <div className="mt-6 text-center text-sm">
              {mode === 'login' ? (
                <p className="text-zinc-600">
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => { setMode('register'); setError(''); }}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Sign up
                  </button>
                </p>
              ) : mode === 'register' ? (
                <p className="text-zinc-600">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Sign in
                  </button>
                </p>
              ) : (
                <p className="text-zinc-600">
                  Remember your password?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          By continuing, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-zinc-600">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-zinc-600">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
