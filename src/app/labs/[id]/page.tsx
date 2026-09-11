'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AssetForm from '@/components/AssetForm';
import AssetList from '@/components/AssetList';

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

interface LabUser {
  id: number;
  name: string;
  email: string;
  role: string;
  employeeId?: string;
}

export default function LabDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const labId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [lab, setLab] = useState<Lab | null>(null);
  const [labUsers, setLabUsers] = useState<LabUser[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssetForm, setShowAssetForm] = useState(false);
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

  const fetchLabDetails = async () => {
    try {
      const response = await fetch(`/api/labs/${labId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setLab(data.lab);
        setLabUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching lab details:', error);
    }
  };

  const fetchLabAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/labs/${labId}/assets`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAssets(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchLabDetails();
    fetchLabAssets();
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
        alert(data.error || 'Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
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

  if (!user || !lab) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => router.push('/labs')}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Labs
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-4xl">🔬</span>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{lab.name}</h1>
                    <p className="text-gray-600">Lab Code: {lab.code}</p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lab.department && (
                    <div>
                      <span className="text-sm text-gray-500">Department</span>
                      <p className="font-medium">{lab.department}</p>
                    </div>
                  )}
                  {lab.building && (
                    <div>
                      <span className="text-sm text-gray-500">Location</span>
                      <p className="font-medium">
                        {lab.building}
                        {lab.floor && `, ${lab.floor}`}
                        {lab.roomNumber && `, Room ${lab.roomNumber}`}
                      </p>
                    </div>
                  )}
                  {lab.capacity && (
                    <div>
                      <span className="text-sm text-gray-500">Capacity</span>
                      <p className="font-medium">{lab.capacity} students</p>
                    </div>
                  )}
                  <div>
                    <span className="text-sm text-gray-500">Status</span>
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

        {/* Lab Team */}
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Lab Team</h2>
          
          {mainTechnician && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">👨‍🔬</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{mainTechnician.name}</p>
                  <p className="text-sm text-gray-600">{mainTechnician.email}</p>
                  {mainTechnician.employeeId && (
                    <p className="text-xs text-gray-500">ID: {mainTechnician.employeeId}</p>
                  )}
                </div>
                <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
                  Main Technician
                </span>
              </div>
            </div>
          )}
          
          {technicians.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Technicians</h3>
              <div className="space-y-2">
                {technicians.map((tech) => (
                  <div key={tech.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-xl">👨‍💼</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{tech.name}</p>
                      <p className="text-sm text-gray-600">{tech.email}</p>
                      {tech.employeeId && (
                        <p className="text-xs text-gray-500">ID: {tech.employeeId}</p>
                      )}
                    </div>
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs font-semibold rounded-full">
                      Technician
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!mainTechnician && technicians.length === 0 && (
            <p className="text-gray-500 text-center py-4">No team members assigned to this lab yet.</p>
          )}
        </div>

        {/* Asset Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Assets', value: totalAssets, icon: '📦', color: 'bg-blue-50 text-blue-600' },
            { label: 'Available', value: available, icon: '✅', color: 'bg-green-50 text-green-600' },
            { label: 'In Use', value: inUse, icon: '🔄', color: 'bg-purple-50 text-purple-600' },
            { label: 'Maintenance', value: maintenance, icon: '🔧', color: 'bg-yellow-50 text-yellow-600' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`text-4xl ${stat.color} rounded-full p-3`}>
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Lab Assets</h2>
          <button
            onClick={() => setShowAssetForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            Add Asset to Lab
          </button>
        </div>

        {/* Assets List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading assets...</p>
          </div>
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

        {/* Asset Form Modal */}
        {showAssetForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <AssetForm
                asset={editingAsset}
                labs={[lab]}
                defaultLabId={lab.id}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}