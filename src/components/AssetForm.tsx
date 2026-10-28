'use client';

import { useState } from 'react';
import { ASSET_CATEGORIES, STATUSES } from '@/lib/assets';

interface AssetFormProps {
  asset?: any;
  labs: any[];
  defaultLabId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssetForm({ asset, labs, defaultLabId, onClose, onSuccess }: AssetFormProps) {
  // Build the initial form state from the asset being edited (all empty on
  // create). Derived this way so state can start in sync with props without
  // a state-setting effect.
  const [formData, setFormData] = useState(() => ({
    name: asset?.name || '',
    category: asset?.category || 'other',
    manufacturer: asset?.manufacturer || '',
    model: asset?.model || '',
    serialNumber: asset?.serialNumber || '',
    labId: asset?.labId?.toString() || defaultLabId?.toString() || '',
    location: asset?.location || '',
    status: asset?.status || 'available',
    purchaseDate: asset?.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
    warrantyExpiry: asset?.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '',
    notes: asset?.notes || '',
  }));
  const [loading, setLoading] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Re-sync the form when the parent supplies a different asset or default
  // lab. This is the render-phase "adjusting state when a prop changes"
  // pattern (React: You Might Not Need an Effect) — no state-setting effect,
  // and preserving the original behavior of not clearing a form when the
  // selected asset is removed.
  const [lastAsset, setLastAsset] = useState(asset);
  const [lastDefaultLabId, setLastDefaultLabId] = useState(defaultLabId);
  if (
    asset &&
    (asset !== lastAsset || defaultLabId !== lastDefaultLabId)
  ) {
    setLastAsset(asset);
    setLastDefaultLabId(defaultLabId);
    setFormData({
      name: asset.name || '',
      category: asset.category || 'other',
      manufacturer: asset.manufacturer || '',
      model: asset.model || '',
      serialNumber: asset.serialNumber || '',
      labId: asset.labId?.toString() || defaultLabId?.toString() || '',
      location: asset.location || '',
      status: asset.status || 'available',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      warrantyExpiry: asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toISOString().split('T')[0] : '',
      notes: asset.notes || '',
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveError('');

    try {
      const url = asset ? `/api/assets/${asset.id}` : '/api/assets';
      const method = asset ? 'PUT' : 'POST';

      const submitData = {
        ...formData,
        labId: parseInt(formData.labId),
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json().catch(() => ({}));
        setSaveError(data.error || 'The asset could not be saved. Review the fields and try again.');
      }
    } catch (error) {
      console.error('Error saving asset:', error);
      setSaveError('The asset could not be saved. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="section-title">{asset ? 'Edit asset' : 'Add asset'}</h2>
          <p className="muted-copy mt-1 text-sm">Record the asset identity, lab, and current status.</p>
        </div>
        <button type="button" onClick={onClose} className="record-action">Close</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="asset-name" className="ui-label">
              Asset Name *
            </label>
            <input
              id="asset-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="ui-field"
              placeholder="e.g., Olympus BX53 Microscope"
            />
          </div>

          <div>
            <label htmlFor="asset-category" className="ui-label">
              Category *
            </label>
            <select
              id="asset-category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="ui-field"
            >
              {ASSET_CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="asset-lab" className="ui-label">
              Lab *
            </label>
            <select
              id="asset-lab"
              name="labId"
              value={formData.labId}
              onChange={handleChange}
              required
              className="ui-field"
            >
              <option value="">Select a lab</option>
              {labs.map(lab => (
                <option key={lab.id} value={lab.id}>
                  {lab.name} ({lab.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="asset-manufacturer" className="ui-label">
              Manufacturer
            </label>
            <input
              id="asset-manufacturer"
              type="text"
              name="manufacturer"
              value={formData.manufacturer}
              onChange={handleChange}
              className="ui-field"
              placeholder="e.g., Olympus"
            />
          </div>

          <div>
            <label htmlFor="asset-model" className="ui-label">
              Model
            </label>
            <input
              id="asset-model"
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              className="ui-field"
              placeholder="e.g., BX53"
            />
          </div>

          <div>
            <label htmlFor="asset-serial" className="ui-label">
              Serial Number
            </label>
            <input
              id="asset-serial"
              type="text"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              className="ui-field"
              placeholder="e.g., SN123456"
            />
          </div>

          <div>
            <label htmlFor="asset-location" className="ui-label">
              Location *
            </label>
            <input
              id="asset-location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              className="ui-field"
              placeholder="e.g., Lab A, Room 101"
            />
          </div>

          <div>
            <label htmlFor="asset-status" className="ui-label">
              Status *
            </label>
            <select
              id="asset-status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="ui-field"
            >
              {STATUSES.map(status => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="asset-purchase-date" className="ui-label">
              Purchase Date
            </label>
            <input
              id="asset-purchase-date"
              type="date"
              name="purchaseDate"
              value={formData.purchaseDate}
              onChange={handleChange}
              className="ui-field"
            />
          </div>

          <div>
            <label htmlFor="asset-warranty-expiry" className="ui-label">
              Warranty Expiry
            </label>
            <input
              id="asset-warranty-expiry"
              type="date"
              name="warrantyExpiry"
              value={formData.warrantyExpiry}
              onChange={handleChange}
              className="ui-field"
            />
          </div>
        </div>

        <div>
          <label htmlFor="asset-notes" className="ui-label">
            Notes
          </label>
          <textarea
            id="asset-notes"
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="ui-field"
            placeholder="Additional notes or comments..."
          />
        </div>

        {saveError && <p role="alert" className="ui-alert">{saveError}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ui-line)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-button-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="ui-button ui-button-primary"
          >
            {loading ? 'Saving...' : asset ? 'Update Asset' : 'Add Asset'}
          </button>
        </div>
      </form>
    </div>
  );
}
