import React, { useState, useEffect } from 'react';
import { ShieldCheck, Mail, Lock, User, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PublicHeader } from '../../components/layout/PublicHeader';

interface AuthPagesProps {
  mode: 'sign-in' | 'sign-up' | 'forgot-password' | 'reset-password' | 'verify-email';
  onNavigate: (path: string) => void;
}

export const AuthPage: React.FC<AuthPagesProps> = ({ mode, onNavigate }) => {
  const {
    isAuthenticated,
    authError,
    clearAuthError,
    signInWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendResetEmail,
    resendVerificationEmail,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    clearAuthError();
  }, [mode]);

  useEffect(() => {
    if (isAuthenticated && (mode === 'sign-in' || mode === 'sign-up')) {
      onNavigate('/app/dashboard');
    }
  }, [isAuthenticated, mode]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const profile = await signInWithGoogle();
      if (!profile.onboardingCompleted) {
        onNavigate('/onboarding/welcome');
      } else {
        onNavigate('/app/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (mode === 'sign-up') {
      if (!fullName.trim() || fullName.trim().length < 2) {
        setError('Full Name must be at least 2 characters.');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      if (password.length < 10) {
        setError('Password must be at least 10 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!acceptTerms) {
        setError('Please accept the Terms of Service and Privacy Policy.');
        return;
      }

      setLoading(true);
      try {
        await registerWithEmail(fullName, email, password);
        onNavigate('/onboarding/welcome');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to create account.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'sign-in') {
      if (!email || !password) {
        setError('Please enter your email and password.');
        return;
      }
      setLoading(true);
      try {
        await loginWithEmail(email, password);
        onNavigate('/app/dashboard');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid email or password.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'forgot-password') {
      if (!email) {
        setError('Please enter your registered email address.');
        return;
      }
      setLoading(true);
      try {
        await sendResetEmail(email);
        setSuccessMsg('If an account exists for this email, password reset instructions have been sent.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to send reset email.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'reset-password') {
      if (!email) {
        setError('Please enter your email address to request a reset link.');
        return;
      }
      setLoading(true);
      try {
        await sendResetEmail(email);
        setSuccessMsg('Password reset link sent to your email. Follow the Firebase link to set your new password.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to send password reset email.');
      } finally {
        setLoading(false);
      }
    } else if (mode === 'verify-email') {
      setLoading(true);
      try {
        await resendVerificationEmail();
        setSuccessMsg('Verification email resent. Please check your inbox.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to resend verification email.');
      } finally {
        setLoading(false);
      }
    }
  };

  const activeError = error || authError;

  return (
    <div className="min-h-screen bg-[#0B1C19] text-[#F5F7F5] flex flex-col">
      <PublicHeader currentPath={`/auth/${mode}`} onNavigate={onNavigate} />

      <div className="flex-1 flex items-center justify-center p-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[#28443C] bg-[#102722] p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#16352E] border border-[#28443C] text-[#A8E6CE] mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-[#F5F7F5]">
              {mode === 'sign-up' && 'Create your FinSight account.'}
              {mode === 'sign-in' && 'Welcome back.'}
              {mode === 'forgot-password' && 'Reset your password.'}
              {mode === 'reset-password' && 'Request password reset.'}
              {mode === 'verify-email' && 'Verify your email address.'}
            </h1>
            <p className="text-xs text-[#A7C1B8]">
              {mode === 'sign-up' && 'Start building a clearer picture of your finances.'}
              {mode === 'sign-in' && 'Sign in with Firebase Authentication to access your financial workspace.'}
              {mode === 'forgot-password' && 'Enter your registered email address to receive password reset instructions.'}
              {mode === 'reset-password' && 'Enter your account email to receive a secure reset link.'}
              {mode === 'verify-email' && 'Check your inbox and open the verification link to continue.'}
            </p>
          </div>

          {activeError && (
            <div className="flex items-start gap-2 rounded-xl bg-[#EB7676]/10 border border-[#EB7676]/30 p-3 text-xs text-[#EB7676]">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{activeError}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 rounded-xl bg-[#55C99A]/10 border border-[#55C99A]/30 p-3 text-xs text-[#55C99A]">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {(mode === 'sign-in' || mode === 'sign-up') && (
            <>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                data-testid="google-signin-button"
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-[#F5F7F5] px-4 py-3 text-xs font-bold text-[#0B1C19] hover:bg-white transition-colors shadow-md disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-[#28443C]" />
                <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-[#718D83]">
                  or with email
                </span>
                <div className="flex-grow border-t border-[#28443C]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'sign-up' && (
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-[#718D83]" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] pl-10 pr-4 py-2.5 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot-password' || mode === 'reset-password') && (
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#718D83]" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] pl-10 pr-4 py-2.5 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'sign-in' || mode === 'sign-up') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#A7C1B8]">Password</label>
                  {mode === 'sign-in' && (
                    <button
                      type="button"
                      onClick={() => onNavigate('/auth/forgot-password')}
                      className="text-[11px] text-[#A8E6CE] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#718D83]" />
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] pl-10 pr-4 py-2.5 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'sign-up' && (
              <div>
                <label className="block text-xs font-medium text-[#A7C1B8] mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#718D83]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl bg-[#0B1C19] border border-[#28443C] pl-10 pr-4 py-2.5 text-xs text-[#F5F7F5] placeholder-[#718D83] focus:border-[#A8E6CE] focus:outline-none"
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'sign-up' && (
              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptTerms}
                  onChange={e => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-[#28443C] bg-[#0B1C19] text-[#A8E6CE] focus:ring-[#A8E6CE]"
                />
                <label htmlFor="terms" className="text-[11px] text-[#A7C1B8] leading-tight">
                  I agree to FinSight's Terms of Service and Privacy Policy.
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#A8E6CE] px-4 py-3 text-xs font-bold text-[#0B1C19] hover:bg-[#72C8B0] transition-colors shadow-md disabled:opacity-50"
            >
              {loading ? 'Processing...' : (
                <>
                  {mode === 'sign-up' && 'Create Account'}
                  {mode === 'sign-in' && 'Sign In'}
                  {mode === 'forgot-password' && 'Send Reset Link'}
                  {mode === 'reset-password' && 'Send Reset Link'}
                  {mode === 'verify-email' && 'Resend Verification'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Alternative actions */}
          <div className="text-center pt-2 border-t border-[#28443C] space-y-2">
            {mode === 'sign-in' && (
              <p className="text-xs text-[#A7C1B8]">
                Don't have an account?{' '}
                <button onClick={() => onNavigate('/auth/sign-up')} className="text-[#A8E6CE] font-semibold hover:underline">
                  Create an Account
                </button>
              </p>
            )}
            {mode === 'sign-up' && (
              <p className="text-xs text-[#A7C1B8]">
                Already have an account?{' '}
                <button onClick={() => onNavigate('/auth/sign-in')} className="text-[#A8E6CE] font-semibold hover:underline">
                  Sign In
                </button>
              </p>
            )}
            {(mode === 'forgot-password' || mode === 'reset-password' || mode === 'verify-email') && (
              <p className="text-xs text-[#A7C1B8]">
                <button onClick={() => onNavigate('/auth/sign-in')} className="text-[#A8E6CE] hover:underline">
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
