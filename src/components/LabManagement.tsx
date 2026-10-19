'use client';

import { useState } from 'react';

export interface College {
  id: number;
  name: string;
  code: string;
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
  collegeId?: number;
}

interface LabManagementProps {
  labs: Lab[];
  colleges?: College[];
  userRole?: string;
  defaultCollegeId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LabManagement({
  labs,
  colleges = [],
  userRole,
  defaultCollegeId,
  onClose,
  onSuccess,
}: LabManagementProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    department: '',
    building: '',
    floor: '',
    roomNumber: '',
    capacity: '',
    collegeId: defaultCollegeId && defaultCollegeId !== 'all' ? defaultCollegeId : '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/labs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          collegeId: formData.collegeId ? parseInt(formData.collegeId) : undefined,
          capacity: formData.capacity ? parseInt(formData.capacity) : null,
        }),
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({
          name: '',
          code: '',
          department: '',
          building: '',
          floor: '',
          roomNumber: '',
          capacity: '',
          collegeId: defaultCollegeId && defaultCollegeId !== 'all' ? defaultCollegeId : '',
        });
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create lab');
      }
    } catch (error) {
      console.error('Error creating lab:', error);
      alert('Failed to create lab');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Lab Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage laboratory facilities and departments</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      {!showForm ? (
        <>
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-sm"
            >
              <span>➕</span> Add New Lab
            </button>
            <span className="text-sm text-gray-500">Total Labs: {labs.length}</span>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {labs.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-8 text-center border border-dashed border-gray-300">
                <p className="text-gray-500">No laboratories found for this institution view.</p>
              </div>
            ) : (
              labs.map((lab) => (
                <div
                  key={lab.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg text-gray-900">{lab.name}</h3>
                      <span className="inline-block mt-1 font-mono text-xs px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded">
                        {lab.code}
                      </span>
                    </div>
                    {lab.capacity && (
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
                        Capacity: {lab.capacity}
                      </span>
                    )}
                  </div>
                  {lab.department && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium text-gray-700">Department:</span> {lab.department}
                    </p>
                  )}
                  {(lab.building || lab.floor || lab.roomNumber) && (
                    <p className="text-sm text-gray-500 mt-1">
                      📍 {lab.building}
                      {lab.floor && `, ${lab.floor}`}
                      {lab.roomNumber && `, Room ${lab.roomNumber}`}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userRole === 'admin' && colleges.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Institution *
                </label>
                <select
                  value={formData.collegeId}
                  onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Select Institution --</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id.toString()}>
                      🏛️ {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lab Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Robotics & Mechatronics Lab"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lab Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., MIT-ROB-101"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Mechatronics Engineering"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Building
              </label>
              <input
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Academic Block 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Floor
              </label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 2nd Floor"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 204"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Capacity (Students)
              </label>
              <input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 40"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Lab'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}