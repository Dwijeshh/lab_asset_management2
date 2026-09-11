'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LabManagement from '@/components/LabManagement';
import CollegeSelector, { College } from '@/components/CollegeSelector';
import NotificationBell from '@/components/NotificationBell';

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
  department?: string | null;
  building?: string | null;
  floor?: string | null;
  roomNumber?: string | null;
  capacity?: number | null;
  isActive: boolean;
  collegeId?: number;
}

export default function LabsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
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
        return null;
      }
      const data = await response.json();
      setUser(data.user);
      return data.user;
    } catch (error) {
      console.error('Error fetching user:', error);
      router.push('/login');
      return null;
    }
  };

  const fetchColleges = async () => {
    try {
      const response = await fetch('/api/colleges', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setColleges(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching colleges:', error);
    }
  };

  const fetchLabs = async (collegeId?: string) => {
    try {
      setLoading(true);
      const targetCollege = collegeId !== undefined ? collegeId : selectedCollegeId;
      const url = targetCollege && targetCollege !== 'all'
        ? `/api/labs?collegeId=${targetCollege}`
        : '/api/labs';

      const response = await fetch(url, {
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

  const handleCollegeChange = (collegeId: string) => {
    setSelectedCollegeId(collegeId);
    fetchLabs(collegeId);
  };

  useEffect(() => {
    const initData = async () => {
      const loggedUser = await fetchUser();
      await fetchColleges();
      if (loggedUser) {
        const initialCollege = loggedUser.role === 'admin' ? 'all' : loggedUser.collegeId.toString();
        setSelectedCollegeId(initialCollege);
        await fetchLabs(initialCollege);
      }
    };
    initData();
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
    admin: 'bg-purple-100 text-purple-800 border-purple-200',
    main_technician: 'bg-blue-100 text-blue-800 border-blue-200',
    technician: 'bg-green-100 text-green-800 border-green-200',
  };

  const roleLabels = {
    admin: 'System Administrator',
    main_technician: 'Main Technician (Head)',
    technician: 'Lab Technician',
  };

  const currentCollege = colleges.find(c => c.id.toString() === selectedCollegeId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-start gap-4">
            <img
              src="/logo.jpg"
              alt="MAHE Logo"
              className="h-14 w-auto object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-sm mt-1"
            />
            <div>
              <div className="flex items-center gap-3 mb-1">
                <button
                  onClick={() => router.push('/')}
                  className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  ← Back to Main Dashboard
                </button>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                Laboratory Management
              </h1>
              <p className="mt-0.5 text-gray-600 font-medium text-sm">
                Manage and monitor all departmental laboratories
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Institution Switcher (Admin only) or Institution Lock Badge */}
            <CollegeSelector
              userRole={user.role}
              userCollegeId={user.collegeId}
              colleges={colleges}
              selectedCollegeId={selectedCollegeId}
              onCollegeChange={handleCollegeChange}
            />

            <div className="flex items-center gap-3 border-l pl-3 border-gray-200">
              <NotificationBell />
              <div className="text-right ml-2">
                <span className="text-sm font-semibold text-gray-800 block">{user.name}</span>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${roleColors[user.role]}`}>
                  {roleLabels[user.role]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 border border-gray-200 transition-colors font-medium"
                title="Sign out"
              >
                Sign out →
              </button>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Scope:
            </span>
            <span className="text-sm font-semibold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-2xs">
              {selectedCollegeId === 'all'
                ? '🌐 All MAHE Institutions'
                : `🏛️ ${currentCollege?.name || 'Selected Institution'}`}
            </span>
            <span className="text-xs text-slate-500 font-medium ml-2">
              ({labs.length} laboratories found)
            </span>
          </div>

          {canCreateLabs && (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
            >
              <span className="text-xl">+</span>
              Create New Lab
            </button>
          )}
        </div>

        {/* Labs Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading labs...</p>
          </div>
        ) : labs.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🏭</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No laboratories found</h3>
            <p className="text-gray-600 mb-4">
              {selectedCollegeId === 'all'
                ? 'No laboratories registered yet in the system.'
                : `No laboratories found for ${currentCollege?.name || 'this institution'}.`}
            </p>
            {canCreateLabs && (
              <button
                onClick={() => setShowForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
              >
                Create First Lab
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs.map((lab) => (
              <div
                key={lab.id}
                onClick={() => router.push(`/labs/${lab.id}`)}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer hover:border-blue-300 group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-3xl p-2 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                    🔬
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    lab.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {lab.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                  {lab.name}
                </h3>
                <p className="font-mono text-xs text-blue-700 font-semibold mb-3">Code: {lab.code}</p>
                
                {lab.department && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                      {lab.department}
                    </span>
                  </div>
                )}
                
                <div className="space-y-1.5 text-sm text-gray-600 mt-2">
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
                
                <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">Dedicated Dashboard</span>
                  <span className="text-sm font-semibold text-blue-600 group-hover:translate-x-1 transition-transform inline-block">
                    Open Lab →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Lab Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
              <LabManagement
                labs={labs}
                colleges={colleges}
                userRole={user.role}
                defaultCollegeId={selectedCollegeId}
                onClose={() => setShowForm(false)}
                onSuccess={() => {
                  fetchLabs(selectedCollegeId);
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