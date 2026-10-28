'use client';

import { useState } from 'react';
import UiIcon from '@/components/UiIcon';

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
  initialForm?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LabManagement({
  labs,
  colleges = [],
  userRole,
  defaultCollegeId,
  initialForm = false,
  onClose,
  onSuccess,
}: LabManagementProps) {
  const [showForm, setShowForm] = useState(initialForm);
  const [error, setError] = useState('');
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
    setError('');
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
        setError(data.error || 'Failed to create lab');
      }
    } catch (error) {
      console.error('Error creating lab:', error);
      setError('Failed to create lab. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 sm:p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="section-title">{showForm ? 'Create lab' : 'Lab management'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage laboratory facilities and departments</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close lab management"
          className="record-action"
        >
          Close
        </button>
      </div>

      {!showForm ? (
        <>
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => setShowForm(true)}
              className="ui-button ui-button-primary"
            >
              Add new lab
            </button>
            <span className="text-sm text-gray-500">Total Labs: {labs.length}</span>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {labs.length === 0 ? (
              <div className="ui-empty">
                <h3>No laboratories in this view</h3>
                <p>Create a lab to begin recording its assets.</p>
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
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-gray-500">
                      <UiIcon name="pin" className="mt-0.5 h-4 w-4 shrink-0" />{lab.building}
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
          {error && <div role="alert" className="ui-alert">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userRole === 'admin' && colleges.length > 0 && (
              <div className="md:col-span-2">
                <label htmlFor="lab-college" className="ui-label">
                  Target Institution *
                </label>
                <select
                  id="lab-college"
                  value={formData.collegeId}
                  onChange={(e) => setFormData({ ...formData, collegeId: e.target.value })}
                  required
                  className="ui-field"
                >
                  <option value="">-- Select Institution --</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id.toString()}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="lab-name" className="ui-label">
                Lab Name *
              </label>
              <input
                id="lab-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="ui-field"
                placeholder="e.g., Robotics & Mechatronics Lab"
              />
            </div>

            <div>
              <label htmlFor="lab-code" className="ui-label">
                Lab Code *
              </label>
              <input
                id="lab-code"
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                required
                className="ui-field"
                placeholder="e.g., MIT-ROB-101"
              />
            </div>

            <div>
              <label htmlFor="lab-department" className="ui-label">
                Department
              </label>
              <input
                id="lab-department"
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="ui-field"
                placeholder="e.g., Mechatronics Engineering"
              />
            </div>

            <div>
              <label htmlFor="lab-building" className="ui-label">
                Building
              </label>
              <input
                id="lab-building"
                type="text"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
                className="ui-field"
                placeholder="e.g., Academic Block 1"
              />
            </div>

            <div>
              <label htmlFor="lab-floor" className="ui-label">
                Floor
              </label>
              <input
                id="lab-floor"
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="ui-field"
                placeholder="e.g., 2nd Floor"
              />
            </div>

            <div>
              <label htmlFor="lab-room" className="ui-label">
                Room Number
              </label>
              <input
                id="lab-room"
                type="text"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                className="ui-field"
                placeholder="e.g., 204"
              />
            </div>

            <div>
              <label htmlFor="lab-capacity" className="ui-label">
                Capacity (Students)
              </label>
              <input
                id="lab-capacity"
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                className="ui-field"
                placeholder="e.g., 40"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="ui-button ui-button-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="ui-button ui-button-primary"
            >
              {loading ? 'Creating...' : 'Create Lab'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
