'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AssetForm from '@/components/AssetForm';
import AssetList from '@/components/AssetList';
import StatsCards from '@/components/StatsCards';
import ModalDialog from '@/components/ModalDialog';
import UiIcon from '@/components/UiIcon';
import AssetExportDialog from '@/components/AssetExportDialog';
import { useSession } from '@/lib/useSession';
import { institutionBanner } from '@/lib/institutionBanner';
import CampusBannerLabel from '@/components/CampusBannerLabel';

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
  collegeCode?: string;
}

interface LabUser {
  id: number;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
}

export default function LabDashboardPage() {
  const params = useParams();
  const labId = params.id as string;
  
  const user = useSession();
  const [lab, setLab] = useState<Lab | null>(null);
  const [labUsers, setLabUsers] = useState<LabUser[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState('');
  const [assetsError, setAssetsError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  const fetchLabDetails = async () => {
    try {
      setDetailsLoading(true);
      setDetailsError('');
      const response = await fetch(`/api/labs/${labId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Unable to load this laboratory.');
      const data = await response.json();
      setLab(data.lab);
      setLabUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching lab details:', error);
      setDetailsError('Unable to load this laboratory. Check your access or try again.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const fetchLabAssets = async () => {
    try {
      setLoading(true);
      setAssetsError('');
      const response = await fetch(`/api/labs/${labId}/assets`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Unable to load assets.');
      const data = await response.json();
      setAssets(data.data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssetsError('Unable to load lab assets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchLabDetails(), fetchLabAssets()]);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    setShowAssetForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchLabAssets();
      } else {
        const data = await response.json();
        setActionError(data.error || 'Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      setActionError('Unable to delete asset. Please try again.');
    }
  };

  const handleFormClose = () => {
    setShowAssetForm(false);
    setEditingAsset(null);
  };

  const handleFormSuccess = () => {
    fetchLabAssets();
    handleFormClose();
  };

  if (!user || detailsLoading) {
    return (
      <div className="campus-page min-h-screen"><main className="page-shell" role="status" aria-label="Loading laboratory"><div className="surface-card ui-loading h-56"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton w-3/4"/><div className="ui-skeleton w-1/2"/></div></main></div>
    );
  }
  if (detailsError || !lab) return <div className="campus-page min-h-screen"><main className="page-shell"><Link href="/labs" className="ui-button ui-button-secondary mb-5">← Back to labs</Link><div role="alert" className="surface-card ui-empty"><h1>Laboratory unavailable</h1><p>{detailsError || 'This laboratory could not be found.'}</p><button onClick={fetchLabDetails} className="ui-button ui-button-primary mt-5">Try again</button></div></main></div>;

  const canDeleteAssets = user.role === 'admin' || user.role === 'main_technician';
  
  // Find main technician for this lab
  const mainTechnician = labUsers.find(u => u.role === 'main_technician');
  const technicians = labUsers.filter(u => u.role === 'technician');
  
  // Asset statistics
  const totalAssets = assets.length;
  const available = assets.filter(a => a.status === 'available').length;
  const inUse = assets.filter(a => a.status === 'in_use').length;
  const maintenance = assets.filter(a => a.status === 'maintenance').length;

  return (
    <div className="campus-page min-h-screen" data-institution={institutionBanner(lab.collegeCode ? { code: lab.collegeCode } : undefined)}>
      <CampusBannerLabel institution={institutionBanner(lab.collegeCode ? { code: lab.collegeCode } : undefined)} name={lab.collegeCode} />
      <main className="page-shell">
        {/* Header */}
        <div className="mb-6">
          <div className="surface-card border-t-[3px] border-t-[var(--ui-primary)] p-5 sm:p-6">
            <Link href="/labs" className="app-back-link mb-4 inline-flex min-h-9 items-center text-sm font-semibold">← Back to Labs</Link>
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-3">
                  <div>
                    <h1 className="app-page-title">{lab.name}</h1>
                    <p className="muted-copy mt-1 text-sm font-semibold">Lab Code: {lab.code}</p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 border-t border-[var(--ui-line)] pt-4 sm:grid-cols-4">
                  {lab.department && (
                    <div>
                      <span className="text-xs font-semibold text-[var(--ui-muted)]">Department</span>
                      <p className="font-medium">{lab.department}</p>
                    </div>
                  )}
                  {lab.building && (
                    <div>
                      <span className="text-xs font-semibold text-[var(--ui-muted)]">Location</span>
                      <p className="font-medium">
                        {lab.building}
                        {lab.floor && `, ${lab.floor}`}
                        {lab.roomNumber && `, Room ${lab.roomNumber}`}
                      </p>
                    </div>
                  )}
                  {lab.capacity && (
                    <div>
                      <span className="text-xs font-semibold text-[var(--ui-muted)]">Capacity</span>
                      <p className="font-medium">{lab.capacity} students</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-semibold text-[var(--ui-muted)]">Status</span>
                    <p className="font-medium">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        lab.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {lab.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-5 flex flex-wrap justify-between items-center gap-3">
          <h2 className="section-title">Lab assets</h2>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowExport(true)} disabled={loading || Boolean(assetsError)} className="ui-button ui-button-secondary">Print / download list</button>
            <button onClick={() => setShowAssetForm(true)} className="ui-button ui-button-primary">
              <UiIcon name="plus" className="h-4 w-4" /> Add asset
            </button>
          </div>
        </div>

        <div className="mb-5"><StatsCards counts={{ total: totalAssets, available, inUse, maintenance }} /></div>

        {/* Assets List */}
        {actionError && <div role="alert" className="ui-alert mb-4">{actionError}</div>}
        {loading ? (
          <div role="status" aria-label="Loading assets" className="surface-card ui-loading"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton w-full"/><div className="ui-skeleton w-3/4"/></div>
        ) : assetsError ? (
          <div role="alert" className="surface-card ui-empty"><h3>Assets unavailable</h3><p>{assetsError}</p><button onClick={fetchLabAssets} className="ui-button ui-button-secondary mt-5">Try again</button></div>
        ) : (
          <AssetList 
            assets={assets} 
            currentUser={user}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRequest={() => {}}
            canDelete={canDeleteAssets}
          />
        )}

        <section aria-labelledby="lab-team-heading" className="surface-card mt-8 p-5 sm:p-6">
          <h2 id="lab-team-heading" className="section-title mb-3">Lab team</h2>
          {mainTechnician || technicians.length > 0 ? (
            <div className="divide-y divide-[var(--ui-line)]">
              {[...(mainTechnician ? [mainTechnician] : []), ...technicians].map((member) => (
                <div key={member.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--ui-ink)]">{member.name}</p>
                    <p className="muted-copy break-all text-sm">{member.email}</p>
                    {member.employeeId && <p className="muted-copy mt-0.5 text-xs">ID: {member.employeeId}</p>}
                  </div>
                  <span className="rounded-full border border-[var(--ui-line)] px-2.5 py-1 text-xs font-semibold">
                    {member.role === 'main_technician' ? 'Main technician' : 'Technician'}
                  </span>
                </div>
              ))}
            </div>
          ) : <p className="muted-copy py-4">No team members are assigned to this lab yet.</p>}
        </section>

        {/* Asset Form Modal */}
        {showExport && <AssetExportDialog onClose={() => setShowExport(false)} filters={{ labId }} scope={lab.name} count={assets.length} />}

        {/* Asset Form Modal */}
        {showAssetForm && (
          <ModalDialog title={editingAsset ? 'Edit asset' : 'Add asset'} onClose={handleFormClose}>
              <AssetForm
                asset={editingAsset}
                labs={[lab]}
                defaultLabId={lab.id}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
              />
          </ModalDialog>
        )}
      </main>
    </div>
  );
}
