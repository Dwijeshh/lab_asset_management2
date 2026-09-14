'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AssetForm from '@/components/AssetForm';
import AssetList from '@/components/AssetList';
import SearchBar from '@/components/SearchBar';
import StatsCards from '@/components/StatsCards';
import LabManagement from '@/components/LabManagement';
import AppHeader from '@/components/AppHeader';
import { logout, useSession, type College, type Lab } from '@/lib/useSession';
import BorrowRequestModal from '@/components/BorrowRequestModal';
import PendingRequestsPanel from '@/components/PendingRequestsPanel';
import ActiveLoansPanel from '@/components/ActiveLoansPanel';

export default function HomePage() {
  const router = useRouter();
  const user = useSession();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [assets, setAssets] = useState<any[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showLabManagement, setShowLabManagement] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assets' | 'requests' | 'loans'>('assets');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestingAsset, setRequestingAsset] = useState<any>(null);

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
      setAssets(data.data || data);
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

  useEffect(() => {
    const initData = async () => {
      if (!user) return;
      await fetchColleges();
      // For non-admin, initialize selectedCollegeId to their assigned college
      const initialCollege = user.role === 'admin' ? 'all' : user.collegeId.toString();
      setSelectedCollegeId(initialCollege);
      await fetchLabs(initialCollege);
      await fetchAssets(initialCollege);
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Derived filter state: assets are the single stored copy; the visible list
  // is always computed from it.
  const filteredAssets = useMemo(() => {
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

    if (statusFilter) {
      filtered = filtered.filter(asset => asset.status === statusFilter);
    }

    if (categoryFilter) {
      filtered = filtered.filter(asset => asset.category === categoryFilter);
    }

    return filtered;
  }, [assets, search, statusFilter, categoryFilter]);

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
        <AppHeader
          user={user}
          colleges={colleges}
          selectedCollegeId={selectedCollegeId}
          onCollegeChange={handleCollegeChange}
          title="Lab Asset Management"
          subtitle="Manipal Academy of Higher Education (MAHE)"
        />

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

        {/* Tabs */}
        <div className="mt-8 mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('assets')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'assets'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Assets Inventory
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'requests'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Borrow Requests
            </button>
            <button
              onClick={() => setActiveTab('loans')}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'loans'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Loans
            </button>
          </nav>
        </div>

        {activeTab === 'assets' && (
          <>
            {/* Action Bar */}
            <div className="mb-6 flex flex-wrap gap-3 justify-between items-center mt-2">
              <SearchBar
                onSearch={(s, st, cat) => {
                  setSearch(s);
                  setStatusFilter(st);
                  setCategoryFilter(cat);
                }}
              />
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
                currentUser={user}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onRequest={(asset) => {
                  setRequestingAsset(asset);
                  setShowRequestModal(true);
                }}
                canDelete={canDeleteAssets || false}
              />
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <PendingRequestsPanel userRole={user.role} />
        )}

        {activeTab === 'loans' && (
          <ActiveLoansPanel userRole={user.role} />
        )}

        {/* Borrow Request Modal */}
        {showRequestModal && requestingAsset && (
          <BorrowRequestModal
            asset={requestingAsset}
            onClose={() => {
              setShowRequestModal(false);
              setRequestingAsset(null);
            }}
            onSuccess={() => {
              setShowRequestModal(false);
              setRequestingAsset(null);
              setActiveTab('requests');
            }}
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