'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AssetForm from '@/components/AssetForm';
import AssetList from '@/components/AssetList';
import SearchBar from '@/components/SearchBar';
import StatsCards from '@/components/StatsCards';
import LabManagement from '@/components/LabManagement';

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
      const response = await fetch('/api/labs', {
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

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/assets', {
        credentials: 'include'
      });
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      const data = await response.json();
      // Handle new pagination response format
      const assetData = data.data || data;
      setAssets(assetData);
      setFilteredAssets(assetData);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
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
    fetchUser();
    fetchLabs();
    fetchAssets();
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
          <div className="flex items-center gap-4">
            <img
              src="/logo.jpg"
              alt="Organization Logo"
              className="h-16 w-auto object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
            />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                Lab Asset Management System
              </h1>
              <p className="mt-1 text-gray-600 font-medium">MAHE Engineering Colleges</p>
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

        {/* Stats Cards */}
        <StatsCards assets={assets} />

        {/* Action Bar */}
        <div className="mb-6 flex flex-wrap gap-3 justify-between items-center">
          <SearchBar onSearch={handleSearch} />
          <div className="flex gap-2">
            {(user.role === 'admin' || user.role === 'main_technician') && (
              <button
                onClick={() => router.push('/labs')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
              >
                <span className="text-xl">🏢</span>
                View Labs
              </button>
            )}
            {canCreateLabs && (
              <button
                onClick={() => setShowLabManagement(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                Create Lab
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <LabManagement
                labs={labs}
                onClose={() => setShowLabManagement(false)}
                onSuccess={() => {
                  fetchLabs();
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