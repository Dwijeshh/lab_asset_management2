'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const SSO_ERRORS: Record<string, string> = {
  sso_failed: 'Single sign-on failed. Please try again or contact your administrator.',
  not_provisioned: 'Your account is not provisioned in this system. Contact your administrator.',
  disabled: 'Your account is disabled. Contact your administrator.',
};

export default function LoginPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<'checking' | 'local'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // With AUTH_PROVIDER=keycloak, GET /api/auth/login redirects to the SSO
  // provider; with the local provider it returns { provider: 'local' }.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Show the SSO error banner if Keycloak redirected back with ?error=.
      const ssoError = new URLSearchParams(window.location.search).get('error');
      if (ssoError && SSO_ERRORS[ssoError]) {
        setError(SSO_ERRORS[ssoError]);
      }
      try {
        const response = await fetch('/api/auth/login', {
          redirect: 'manual',
          credentials: 'include',
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            window.location.href = location;
            return;
          }
        }
      } catch {
        // Network error: fall back to the local form rather than a dead end.
      }
      if (!cancelled) setAuthMode('local');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important: include cookies
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      // Small delay to ensure cookie is set
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to home page
      router.push('/');
    } catch {
      setError('An error occurred during login. Please try again.');
      setLoading(false);
    }
  };

  return (
    <main className="login-page min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
      <section className="relative min-h-64 overflow-hidden bg-stone-900 lg:sticky lg:top-0 lg:h-screen lg:min-h-0 lg:self-start" aria-label="MAHE Manipal campus">
        <Image
          src="/mahe-administration.jpg"
          alt="Administrative building of Manipal Academy of Higher Education in Manipal"
          fill
          priority
          sizes="(min-width: 1024px) calc(100vw - 520px), 100vw"
          className="object-cover object-center"
        />
        <div className="login-photo-overlay absolute inset-0" aria-hidden="true" />
        <div className="absolute bottom-12 left-6 right-6 text-white sm:left-10 lg:bottom-16 lg:left-14 lg:right-14">
          <p className="login-photo-label mb-2 text-sm font-semibold tracking-wide">MAHE · MANIPAL</p>
          <p className="max-w-xl text-2xl font-bold leading-tight tracking-tight sm:text-4xl">A clearer view of every lab asset.</p>
        </div>
      </section>
      <div className="login-form-panel relative -mt-6 flex min-w-0 items-center rounded-t-3xl px-4 pb-10 pt-8 sm:px-8 lg:mt-0 lg:min-h-screen lg:rounded-none lg:px-10 lg:py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="login-card surface-card overflow-hidden border-t-4 p-6 shadow-lg sm:p-9">
          {/* Header */}
          <div className="mb-5 text-center">
            <div className="mb-2 flex justify-center">
              <Image
                src="/logo.jpg"
                alt="MAHE logo"
                width={80}
                height={80}
                className="login-logo h-16 w-auto rounded-xl border border-stone-200 bg-white p-2 object-contain shadow-sm"
              />
            </div>
            <h1 className="login-title mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Lab Asset Manager
            </h1>
            <p className="login-muted font-medium">Manipal Academy of Higher Education (MAHE)</p>
          </div>

          {/* Error Message */}
          {error && (
            <div role="alert" className="ui-alert mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {authMode === 'checking' ? (
            <div role="status" className="py-8 text-center">
              <div className="login-spinner mx-auto h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
              <p className="login-muted mt-4 text-sm">Checking sign-in method…</p>
            </div>
          ) : (
            <>
              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="login-label ui-label">
                    Email Address
                  </label>
                  <input
                    id="login-email"
                    autoComplete="username"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="login-input ui-field"
                    placeholder="your.email@manipal.edu"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="login-label ui-label">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="login-input ui-field pr-20"
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={loading} className="login-password-toggle">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="login-submit ui-button w-full"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Demo Credentials */}
              <div className="login-divider mt-5 border-t pt-3">
                <p className="login-muted mb-2 text-xs font-semibold">Demo credentials</p>
                <dl className="login-demo-list text-xs">
                  <div className="login-demo-row"><dt>Admin</dt><dd>admin@manipal.edu / password123</dd></div>
                  <div className="login-demo-row"><dt>Main tech</dt><dd>main.tech@manipal.edu / password123</dd></div>
                  <div className="login-demo-row"><dt>Technician</dt><dd>tech1@manipal.edu / password123</dd></div>
                </dl>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="login-muted mt-6 text-center text-xs leading-relaxed">
          Campus photo: <a className="login-credit-link underline" href="https://commons.wikimedia.org/wiki/File:MAHEMANIPALEDU.jpg" target="_blank" rel="noopener noreferrer">Lann the Clever / Wikimedia Commons</a> · <a className="login-credit-link underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · resized and cropped for display.
        </p>
      </div>
      </div>
    </main>
  );
}
