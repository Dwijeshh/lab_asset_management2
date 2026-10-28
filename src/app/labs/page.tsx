'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import LabManagement from '@/components/LabManagement';
import AppHeader from '@/components/AppHeader';
import ModalDialog from '@/components/ModalDialog';
import UiIcon from '@/components/UiIcon';
import { useSession, type College, type Lab } from '@/lib/useSession';
import { institutionBanner } from '@/lib/institutionBanner';
import CampusBannerLabel from '@/components/CampusBannerLabel';

export default function LabsPage() {
  const user = useSession();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>('all');
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const labsRequestId = useRef(0);

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
    const requestId = ++labsRequestId.current;
    try {
      setLoading(true);
      setError('');
      const targetCollege = collegeId !== undefined ? collegeId : selectedCollegeId;
      const url = targetCollege && targetCollege !== 'all'
        ? `/api/labs?collegeId=${targetCollege}`
        : '/api/labs';

      const response = await fetch(url, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Unable to load laboratories. Please try again.');
      const data = await response.json();
      if (requestId === labsRequestId.current) setLabs(data.data || []);
    } catch (error) {
      if (requestId === labsRequestId.current) {
        console.error('Error fetching labs:', error);
        setError('Unable to load laboratories. Please try again.');
      }
    } finally {
      if (requestId === labsRequestId.current) setLoading(false);
    }
  };

  const handleCollegeChange = (collegeId: string) => {
    setSelectedCollegeId(collegeId);
    fetchLabs(collegeId);
  };

  useEffect(() => {
    const initData = async () => {
      if (!user) return;
      await fetchColleges();
      const initialCollege = user.role === 'admin' ? 'all' : user.collegeId.toString();
      setSelectedCollegeId(initialCollege);
      await fetchLabs(initialCollege);
    };
    initData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const canCreateLabs = user && (user.role === 'admin' || user.role === 'main_technician');

  if (!user) {
    return (
      <div className="campus-page min-h-screen"><main className="page-shell"><p role="status" className="surface-card mx-auto max-w-md p-8 text-center muted-copy">Loading laboratories…</p></main></div>
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
          backLink={{ label: 'Back to Main Dashboard', href: '/' }}
          title="Laboratory Management"
          subtitle="Manage and monitor all departmental laboratories"
        />

        {/* Action Bar */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="section-title">Laboratories</h2>
            <p className="muted-copy mt-1 text-sm">{selectedCollegeId === 'all' ? 'All MAHE institutions' : currentCollege?.name || 'Selected institution'} · {labs.length} {labs.length === 1 ? 'lab' : 'labs'}</p>
          </div>

          {canCreateLabs && (
            <button
              onClick={() => setShowForm(true)}
              className="ui-button ui-button-primary"
            >
              <UiIcon name="plus" className="h-4 w-4" /> Create lab
            </button>
          )}
        </div>

        {/* Labs Grid */}
        {loading ? (
          <div role="status" aria-label="Loading laboratories" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0,1,2].map((item) => <div key={item} className="surface-card ui-loading h-56"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton w-3/4"/><div className="ui-skeleton w-1/2"/></div>)}</div>
        ) : error ? (
          <div role="alert" className="surface-card ui-empty"><h2>Laboratories unavailable</h2><p>{error}</p><button onClick={() => fetchLabs()} className="ui-button ui-button-secondary mt-5">Try again</button></div>
        ) : labs.length === 0 ? (
          <div className="surface-card ui-empty">
            <h3>No laboratories found</h3>
            <p className="text-gray-600 mb-4">
              {selectedCollegeId === 'all'
                ? 'No laboratories registered yet in the system.'
                : `No laboratories found for ${currentCollege?.name || 'this institution'}.`}
            </p>
            {canCreateLabs && (
              <button
                onClick={() => setShowForm(true)}
                className="ui-button ui-button-primary mt-5"
              >
                Create First Lab
              </button>
            )}
          </div>
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {labs.map((lab) => (
              <Link
                href={`/labs/${lab.id}`}
                key={lab.id}
                className="surface-card group flex min-h-56 flex-col p-5 transition-colors sm:p-6"
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-lg font-bold leading-snug text-gray-900 transition-colors group-hover:text-blue-600">
                    {lab.name}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                    lab.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {lab.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="mb-3 text-sm font-medium text-blue-700">Code {lab.code}</p>
                
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
                      <UiIcon name="pin" className="h-4 w-4 shrink-0" />
                      <span>
                        {lab.building}
                        {lab.floor && `, ${lab.floor}`}
                        {lab.roomNumber && `, Room ${lab.roomNumber}`}
                      </span>
                    </div>
                  )}
                  {lab.capacity && (
                    <div className="flex items-center gap-2">
                      <UiIcon name="users" className="h-4 w-4 shrink-0" />
                      <span>Capacity: {lab.capacity} students</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-auto flex items-center justify-end border-t border-[var(--ui-line)] pt-4 text-sm font-semibold text-blue-600">
                  Open lab →
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Lab Modal */}
        {showForm && (
          <ModalDialog title="Create lab" onClose={() => setShowForm(false)}>
              <LabManagement
                labs={labs}
                colleges={colleges}
                userRole={user.role}
                defaultCollegeId={selectedCollegeId}
                initialForm
                onClose={() => setShowForm(false)}
                onSuccess={() => {
                  fetchLabs(selectedCollegeId);
                  setShowForm(false);
                }}
              />
          </ModalDialog>
        )}
      </main>
    </div>
  );
}
