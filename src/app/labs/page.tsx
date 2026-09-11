'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LabManagement from '@/components/LabManagement';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'main_technician' | 'technician';
  collegeId: number;
  labId: number | null;
}

interface Lab {
  id: number;
  name: string;
  code: string;
  department?: string;
  building?: string;
  floor?: string;
  roomNumber?: string;
  capacity?: number;
  isActive: boolean;
}

export default function LabsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user:', error);
      router.push('/login');
    }
  };

  const fetchLabs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/labs', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setLabs(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching labs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchLabs();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const canCreateLabs = user && (user.role === 'admin' || user.role === 'main_technician');

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const roleColors = {
    admin: 'bg-purple-100 text-purple-800',
    main_technician: 'bg-blue-100 text-blue-800',
    technician: 'bg-green-100 text-green-800',
  };

  const roleLabels = {
    admin: 'Administrator',
    main_technician: 'Main Technician',
    technician: 'Technician',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div className="flex items-start gap-4">
            <img
              src="/logo.jpg"
              alt="Organization Logo"
              className="h-14 w-auto object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-sm mt-1"
            />
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => router.push('/')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  ← Back to Dashboard
                </button>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                Laboratory Management
              </h1>
              <p className="mt-1 text-gray-600 font-medium">Manage and view all laboratory spaces</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-sm text-gray-600">{user.name}</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${roleColors[user.role]}`}>
                {roleLabels[user.role]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign out →
            </button>
          </div>
        </div>

        {/* Action Bar */}
        {canCreateLabs && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
            >
              <span className="text-xl">+</span>
              Create New Lab
            </button>
          </div>
        )}

        {/* Labs Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading labs...</p>
          </div>
        ) : labs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🏭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No labs found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first laboratory.</p>
            {canCreateLabs && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create Lab
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs.map((lab) => (
              <div
                key={lab.id}
                onClick={() => router.push(`/labs/${lab.id}`)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl">🔬</div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    lab.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {lab.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{lab.name}</h3>
                <p className="text-sm text-gray-500 mb-3">Code: {lab.code}</p>
                
                {lab.department && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                      {lab.department}
                    </span>
                  </div>
                )}
                
                <div className="space-y-1 text-sm text-gray-600">
                  {lab.building && (
                    <div className="flex items-center gap-2">
                      <span>📍</span>
                      <span>
                        {lab.building}
                        {lab.floor && `, ${lab.floor}`}
                        {lab.roomNumber && `, Room ${lab.roomNumber}`}
                      </span>
                    </div>
                  )}
                  {lab.capacity && (
                    <div className="flex items-center gap-2">
                      <span>👥</span>
                      <span>Capacity: {lab.capacity} students</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/labs/${lab.id}`);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View Dashboard →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Lab Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <LabManagement
                labs={labs}
                onClose={() => setShowForm(false)}
                onSuccess={() => {
                  fetchLabs();
                  setShowForm(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}