'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AssetForm from '@/components/AssetForm';
import AssetList from '@/components/AssetList';
import SearchBar from '@/components/SearchBar';
import StatsCards from '@/components/StatsCards';
import LabManagement from '@/components/LabManagement';
import AppHeader from '@/components/AppHeader';
import { useSession, type College, type Lab } from '@/lib/useSession';
import { institutionBanner } from '@/lib/institutionBanner';
import CampusBannerLabel from '@/components/CampusBannerLabel';
import BorrowRequestModal from '@/components/BorrowRequestModal';
import PendingRequestsPanel from '@/components/PendingRequestsPanel';
import ActiveLoansPanel from '@/components/ActiveLoansPanel';
import ModalDialog from '@/components/ModalDialog';
import UiIcon from '@/components/UiIcon';
import AssetExportDialog from '@/components/AssetExportDialog';

export default function HomePage() {
  const router = useRouter();
  const user = useSession();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [assets, setAssets] = useState<any[]>([]);
  const [assetPage, setAssetPage] = useState(1);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetCounts, setAssetCounts] = useState({ total: 0, available: 0, inUse: 0, maintenance: 0 });
  const [labs, setLabs] = useState<Lab[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [assetsError, setAssetsError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showLabManagement, setShowLabManagement] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assets' | 'requests' | 'loans'>('assets');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [requestingAsset, setRequestingAsset] = useState<any>(null);
  const labsRequestId = useRef(0);

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
    const requestId = ++labsRequestId.current;
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
        if (requestId === labsRequestId.current) setLabs(data.data || []);
      }
    } catch (error) {
      if (requestId === labsRequestId.current) console.error('Error fetching labs:', error);
    }
  };

  const fetchAssets = async (collegeId = selectedCollegeId, page = assetPage, signal?: AbortSignal) => {
    try {
      setLoading(true);
      setAssetsError('');
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (collegeId && collegeId !== 'all') params.set('collegeId', collegeId);
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const response = await fetch(`/api/assets?${params}`, {
        credentials: 'include', signal
      });
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      if (!response.ok) throw new Error('Unable to load assets');
      const data = await response.json();
      if (signal?.aborted) return;
      if (page > 1 && (data.data?.length ?? 0) === 0 && (data.pagination?.total ?? 0) > 0) {
        setAssetPage(page - 1);
        return;
      }
      setAssets(data.data || []);
      setAssetTotal(data.pagination?.total ?? 0);
      setAssetCounts(data.statusCounts ?? { total: 0, available: 0, inUse: 0, maintenance: 0 });
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Error fetching assets:', error);
      setAssetsError('Assets could not be loaded. Check your connection and try again.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const handleCollegeChange = (collegeId: string) => {
    setSelectedCollegeId(collegeId);
    setAssetPage(1);
    fetchLabs(collegeId);
  };

  useEffect(() => {
    const initData = async () => {
      if (!user) return;
      await fetchColleges();
      // For non-admin, initialize selectedCollegeId to their assigned college
      const initialCollege = user.role === 'admin' ? 'all' : user.collegeId.toString();
      setSelectedCollegeId(initialCollege);
      await fetchLabs(initialCollege);
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchAssets(selectedCollegeId, assetPage, controller.signal);
    }, search ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedCollegeId, assetPage, search, statusFilter, categoryFilter]);

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
      <div className="campus-page min-h-screen">
        <main className="page-shell"><div className="surface-card mx-auto max-w-md p-8 text-center" role="status">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div></main>
      </div>
    );
  }

  const currentCollege = colleges.find(c => c.id.toString() === selectedCollegeId);

  return (
    <div className="campus-page min-h-screen" data-institution={institutionBanner(currentCollege, selectedCollegeId === 'all')}>
      <CampusBannerLabel institution={institutionBanner(currentCollege, selectedCollegeId === 'all')} name={currentCollege?.name} />
      <main className="page-shell">
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
        <div className="scope-banner mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <UiIcon name="pin" className="h-5 w-5 shrink-0 text-blue-700" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-blue-700 block">Viewing</span>
              <p className="text-sm font-medium text-blue-900 break-words">
                {selectedCollegeId === 'all'
                  ? 'All MAHE institutions'
                  : currentCollege?.name || 'Selected institution'}
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-blue-700 font-medium hidden sm:block">
            <span>{labs.length} Laboratories</span> • <span>{loading ? 'Loading assets…' : `${assetCounts.total} Registered Assets`}</span>
          </div>
        </div>

        {/* Stats Cards */}
        {!loading && !assetsError && <StatsCards counts={assetCounts} />}

        {/* Tabs */}
        <div className="mt-8 mb-4 border-b border-gray-200">
          <nav aria-label="Dashboard sections" className="dashboard-nav -mb-px flex max-w-full gap-5 overflow-x-auto sm:gap-8">
            <button
              onClick={() => setActiveTab('assets')}
              aria-pressed={activeTab === 'assets'}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'assets'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Assets Inventory
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              aria-pressed={activeTab === 'requests'}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'requests'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Borrow Requests
            </button>
            <button
              onClick={() => setActiveTab('loans')}
              aria-pressed={activeTab === 'loans'}
              className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'loans'
                  ? 'border-blue-600 text-blue-700'
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
            <div className="mb-6 flex min-w-0 flex-col gap-3 mt-2 xl:flex-row xl:items-center xl:justify-between">
              <SearchBar
                onSearch={(s, st, cat) => {
                  setAssetPage(1);
                  setSearch(s);
                  setStatusFilter(st);
                  setCategoryFilter(cat);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowExport(true)} disabled={loading || Boolean(assetsError)} className="ui-button ui-button-secondary">
                  Print / download list
                </button>
                {(user.role === 'admin' || user.role === 'main_technician') && (
                  <button
                    onClick={() => router.push('/labs')}
                    className="ui-button ui-button-secondary"
                  >
                    <UiIcon name="lab" className="h-4 w-4" />
                    View Labs
                  </button>
                )}
                {canCreateLabs && (
                  <button
                    onClick={() => setShowLabManagement(true)}
                    className="ui-button ui-button-secondary"
                  >
                    <UiIcon name="plus" className="h-4 w-4" />
                    Create Lab
                  </button>
                )}
                <button
                  onClick={() => setShowForm(true)}
                  className="ui-button ui-button-primary"
                >
                  <UiIcon name="plus" className="h-4 w-4" />
                  Add Asset
                </button>
              </div>
            </div>

            {/* Asset List */}
            {loading ? (
              <div role="status" aria-label="Loading assets" className="surface-card ui-loading"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton"/><div className="ui-skeleton w-3/4"/></div>
            ) : assetsError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{assetsError} <button type="button" onClick={() => fetchAssets()} className="ml-2 font-semibold underline">Retry</button></div>
            ) : (
              <AssetList
                assets={assets}
                hasFilters={Boolean(search || statusFilter || categoryFilter)}
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
            {!loading && !assetsError && assetTotal > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                <span>Showing {Math.min((assetPage - 1) * 50 + 1, assetTotal)}–{Math.min(assetPage * 50, assetTotal)} of {assetTotal} matching assets</span>
                <div className="flex gap-2">
                  <button type="button" disabled={assetPage === 1} onClick={() => setAssetPage(page => page - 1)} className="ui-button ui-button-secondary">Previous</button>
                  <button type="button" disabled={assetPage * 50 >= assetTotal} onClick={() => setAssetPage(page => page + 1)} className="ui-button ui-button-secondary">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'requests' && (
          <PendingRequestsPanel key={selectedCollegeId} userRole={user.role} collegeId={selectedCollegeId} />
        )}

        {activeTab === 'loans' && (
          <ActiveLoansPanel key={selectedCollegeId} userRole={user.role} collegeId={selectedCollegeId} />
        )}

        {/* Borrow Request Modal */}
        {showExport && (
          <AssetExportDialog
            onClose={() => setShowExport(false)}
            filters={{ collegeId: selectedCollegeId, search, status: statusFilter, category: categoryFilter }}
            scope={selectedCollegeId === 'all' ? 'All MAHE institutions' : currentCollege?.name || 'Selected institution'}
            count={assetTotal}
          />
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
          <ModalDialog title={editingAsset ? 'Edit Asset' : 'Add New Asset'} onClose={handleFormClose}>
              <AssetForm
                asset={editingAsset}
                labs={labs}
                defaultLabId={user.labId}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
              />
          </ModalDialog>
        )}

        {/* Lab Management Modal */}
        {showLabManagement && (
          <ModalDialog title="Manage laboratories" onClose={() => setShowLabManagement(false)}>
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
          </ModalDialog>
        )}
      </main>
    </div>
  );
}
