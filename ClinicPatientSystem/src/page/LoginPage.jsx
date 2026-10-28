import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/context/AuthContext.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handlePasswordResetRequest = (event) => {
    event.preventDefault();
    setResetNotice(
      'Automatic password reset is not configured yet. Please contact clinic support for help.'
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: username.trim(), password }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        const message = response.status === 401
          ? 'Authentication failed.'
          : result?.message || 'Unable to sign in. Please try again.';
        throw new Error(message);
      }

      login(result.user, result.token);
      if (result.user.mustChangePassword) {
        navigate('/change-password', { replace: true });
        return;
      }
      const role = String(result.user.activeRole || result.user.role || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ');

      if (role === 'card chief') {
        navigate('/card-room', { replace: true });
      } else if (role.includes('clinic head')) {
        navigate('/clinic-head', { replace: true });
      } else if (role.includes('admin')) {
        navigate('/admin', { replace: true });
      } else if (result.user.department) {
        navigate('/purchase-requests', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (loginError) {
      setError(
        loginError.name === 'AbortError'
          ? 'Login request timed out after 30 seconds. Check your connection and try again.'
          : loginError instanceof TypeError
            ? 'Unable to reach the clinic server. Run "npm run backend" from the project root and check the MongoDB connection, then try again.'
          : loginError.message || 'Unable to connect to the server.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200/60 bg-white p-8 shadow-sm sm:p-10">
        {showPasswordReset ? (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-wide text-[#1f5882]">
                RESET PASSWORD
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-600">
                We will help you get back into your account.
              </p>
            </div>

            <form onSubmit={handlePasswordResetRequest} className="space-y-5">
              <div>
                <label htmlFor="reset-identifier" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Username or email address
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white transition focus-within:border-[#1f5882] focus-within:ring-1 focus-within:ring-[#1f5882]">
                  <div className="flex items-center justify-center border-r border-slate-200 bg-slate-50/80 px-3.5 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="reset-identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={resetIdentifier}
                    onChange={(event) => {
                      setResetIdentifier(event.target.value);
                      setResetNotice('');
                    }}
                    placeholder="e.g. jdoe123 or jane.doe@bdu.edu.et"
                    className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-600">
                Enter the username or email linked to your account. Contact clinic support to receive password reset instructions.
              </p>

              {resetNotice && (
                <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  {resetNotice}{' '}
                  <a href="mailto:support@clinicmau.org" className="font-semibold underline">
                    Contact support
                  </a>
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowPasswordReset(false);
                  setResetNotice('');
                }}
                className="block text-sm font-semibold text-[#28709f] hover:underline"
              >
                Back to login
              </button>

              <button
                type="submit"
                className="mt-1 w-full rounded-lg bg-[#235d88] py-3 text-sm font-bold tracking-wide text-white shadow-sm transition hover:bg-[#1a4a6e] active:scale-[0.99]"
              >
                SEND RESET INSTRUCTIONS
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold tracking-wide text-[#1f5882]">USER LOGIN</h1>
              <p className="mt-2 text-sm font-medium text-slate-600">Welcome back!</p>
              {location.state?.message && (
                <p role="status" className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {location.state.message}
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Username
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white transition focus-within:border-[#1f5882] focus-within:ring-1 focus-within:ring-[#1f5882]">
                  <div className="flex items-center justify-center border-r border-slate-200 bg-slate-50/80 px-3.5 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    id="login-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="clinichead or clinichead@bdu.edu.et"
                    className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Password
                </label>
                <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white transition focus-within:border-[#1f5882] focus-within:ring-1 focus-within:ring-[#1f5882]">
                  <div className="flex items-center justify-center border-r border-slate-200 bg-slate-50/80 px-3.5 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="flex items-center justify-center px-3 text-slate-500 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>

                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordReset(true);
                      setResetNotice('');
                    }}
                    className="text-xs font-semibold text-[#1f5882] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-4 flex w-full items-center justify-center space-x-2 rounded-lg bg-[#235d88] py-3 text-sm font-bold tracking-wide text-white shadow-sm transition hover:bg-[#1a4a6e] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>{submitting ? 'SIGNING IN...' : 'LOG IN'}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
