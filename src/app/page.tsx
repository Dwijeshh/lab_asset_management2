'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AssetForm from '@/components/AssetForm';
import AssetList from '@/components/AssetList';
import SearchBar from '@/components/SearchBar';
import StatsCards from '@/components/StatsCards';
import LabManagement from '@/components/LabManagement';
import CollegeSelector, { College } from '@/components/CollegeSelector';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'main_technician' | 'technician';
  collegeId: number;
  labId: number | null;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [assets, setAssets] = useState<any[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLabManagement, setShowLabManagement] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);

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
        credentials: 'include',
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
    }
  };

  const fetchAssets = async (collegeId?: string) => {
    try {
      setLoading(true);
      const targetCollege = collegeId !== undefined ? collegeId : selectedCollegeId;
      const url = targetCollege && targetCollege !== 'all'
        ? `/api/assets?collegeId=${targetCollege}`
        : '/api/assets';

      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      const assetData = data.data || data;
      setAssets(assetData);
      setFilteredAssets(assetData);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollegeChange = (collegeId: string) => {
    setSelectedCollegeId(collegeId);
    fetchLabs(collegeId);
    fetchAssets(collegeId);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  useEffect(() => {
    const initData = async () => {
      const loggedUser = await fetchUser();
      await fetchColleges();
      if (loggedUser) {
        // For non-admin, initialize selectedCollegeId to their assigned college
        const initialCollege = loggedUser.role === 'admin' ? 'all' : loggedUser.collegeId.toString();
        setSelectedCollegeId(initialCollege);
        await fetchLabs(initialCollege);
        await fetchAssets(initialCollege);
      }
    };
    initData();
  }, []);

  const handleSearch = (search: string, status: string, category: string) => {
    let filtered = assets;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(asset =>
        asset.name?.toLowerCase().includes(searchLower) ||
        asset.serialNumber?.toLowerCase().includes(searchLower) ||
        asset.manufacturer?.toLowerCase().includes(searchLower) ||
        asset.location?.toLowerCase().includes(searchLower)
      );
    }

    if (status) {
      filtered = filtered.filter(asset => asset.status === status);
    }

    if (category) {
      filtered = filtered.filter(asset => asset.category === category);
    }

    setFilteredAssets(filtered);
  };

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchAssets();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
    }
  };

  const canCreateLabs = user && (user.role === 'admin' || user.role === 'main_technician');
  const canDeleteAssets = user && (user.role === 'admin' || user.role === 'main_technician');

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAsset(null);
  };

  const handleFormSuccess = () => {
    fetchAssets();
    handleFormClose();
  };

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
          <div className="flex items-center gap-4">
            <img
              src="/logo.jpg"
              alt="MAHE Logo"
              className="h-16 w-auto object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                Lab Asset Management
              </h1>
              <p className="mt-0.5 text-gray-600 font-medium text-sm">
                Manipal Academy of Higher Education (MAHE)
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
              <div className="text-right">
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

        {/* Institution Scope Notification Banner */}
        <div className="mb-6 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 px-4 py-3 rounded-xl shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">
              {selectedCollegeId === 'all' ? '🌐' : '🏛️'}
            </span>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 block">
                Active Dashboard Scope
              </span>
              <p className="text-sm font-medium text-blue-900">
                {selectedCollegeId === 'all'
                  ? 'Viewing Network-Wide Overview across all MAHE Institutions'
                  : `Viewing: ${currentCollege?.name || 'Selected Institution'} (${currentCollege?.code || ''})`}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-blue-700 font-medium hidden sm:block">
            <span>{labs.length} Laboratories</span> • <span>{assets.length} Registered Assets</span>
          </div>
        </div>

        {/* Stats Cards */}
        <StatsCards assets={assets} />

        {/* Action Bar */}
        <div className="mb-6 flex flex-wrap gap-3 justify-between items-center mt-6">
          <SearchBar onSearch={handleSearch} />
          <div className="flex gap-2">
            {(user.role === 'admin' || user.role === 'main_technician') && (
              <button
                onClick={() => router.push('/labs')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
              >
                <span className="text-xl">🏢</span>
                View Labs
              </button>
            )}
            {canCreateLabs && (
              <button
                onClick={() => setShowLabManagement(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
              >
                <span className="text-xl">➕</span>
                Create Lab
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
            >
              <span className="text-xl">+</span>
              Add Asset
            </button>
          </div>
        </div>

        {/* Asset List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading assets...</p>
          </div>
        ) : (
          <AssetList 
            assets={filteredAssets} 
            onEdit={handleEdit}
            onDelete={handleDelete}
            canDelete={canDeleteAssets || false}
          />
        )}

        {/* Asset Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
              <AssetForm
                asset={editingAsset}
                labs={labs}
                defaultLabId={user.labId}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
              />
            </div>
          </div>
        )}

        {/* Lab Management Modal */}
        {showLabManagement && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
              <LabManagement
                labs={labs}
                colleges={colleges}
                userRole={user.role}
                defaultCollegeId={selectedCollegeId}
                onClose={() => setShowLabManagement(false)}
                onSuccess={() => {
                  fetchLabs(selectedCollegeId);
                  setShowLabManagement(false);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}