'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Submitting login...');
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Important: include cookies
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      console.log('Login successful, redirecting...');
      // Small delay to ensure cookie is set
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Redirect to home page
      window.location.href = '/';
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login: ' + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src="/logo.jpg"
                alt="Organization Logo"
                className="h-20 w-auto object-contain rounded-xl border border-gray-100 bg-white p-2 shadow-sm"
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">
              Lab Asset Manager
            </h1>
            <p className="text-gray-600 font-medium">Manipal Academy of Higher Education (MAHE)</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your.email@manipal.edu"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3 font-semibold uppercase tracking-wide">Demo Credentials</p>
            <div className="space-y-2 text-xs">
              <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg">
                <p className="font-semibold text-purple-700">System Admin:</p>
                <p className="text-gray-600">admin@mahe.in / admin123</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                <p className="font-semibold text-blue-700">Main Technician (MIT):</p>
                <p className="text-gray-600">main.mit@mahe.in / main123</p>
              </div>
              <div className="bg-green-50 border border-green-100 p-3 rounded-lg">
                <p className="font-semibold text-green-700">Lab Technician (MIT):</p>
                <p className="text-gray-600">tech.mit@mahe.in / tech123</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-6">
          © 2024 MAHE - Manipal Academy of Higher Education
        </p>
      </div>
    </div>
  );
}