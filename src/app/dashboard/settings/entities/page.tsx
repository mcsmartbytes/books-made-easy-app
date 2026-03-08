'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase';

interface Entity {
  id: string;
  name: string;
  legal_name: string;
  entity_type: string;
  tax_id: string;
  status: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip: string;
  organization_id: string;
}

interface Location {
  id: string;
  name: string;
  address_line1: string;
  city: string;
  state: string;
  zip: string;
  is_primary: boolean;
  entity_id: string;
}

interface UserRole {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  entity_id: string;
  entity_name: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
}

const ENTITY_TYPES = [
  'LLC',
  'S-Corp',
  'C-Corp',
  'Partnership',
  'Sole Proprietorship',
  'Non-Profit',
  'Trust',
  'Other',
];

const ROLE_OPTIONS = ['owner', 'admin', 'manager', 'accountant', 'viewer'];

export default function EntityManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [locations, setLocations] = useState<Record<string, Location[]>>({});
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [expandedEntities, setExpandedEntities] = useState<Set<string>>(new Set());

  // Org editing
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState('');

  // Entity form
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [entityForm, setEntityForm] = useState({
    name: '',
    legal_name: '',
    entity_type: 'LLC',
    tax_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    zip: '',
  });

  // Location form
  const [showLocationForm, setShowLocationForm] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    address_line1: '',
    city: '',
    state: '',
    zip: '',
    is_primary: false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const res = await fetch(`/api/entities?user_id=${user.id}`);
      const result = await res.json();

      if (result.success) {
        setOrganization(result.organization || null);
        setOrgName(result.organization?.name || '');
        setEntities(result.entities || []);
        setUserRoles(result.userRoles || []);

        // Load locations for each entity
        const locMap: Record<string, Location[]> = {};
        for (const entity of result.entities || []) {
          const locRes = await fetch(`/api/entities/${entity.id}/locations`);
          const locResult = await locRes.json();
          if (locResult.success) {
            locMap[entity.id] = locResult.locations || [];
          }
        }
        setLocations(locMap);
      }
    } catch (err) {
      console.error('Failed to load entity data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrg = async () => {
    if (!organization) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName }),
      });
      const result = await res.json();
      if (result.success) {
        setOrganization({ ...organization, name: orgName });
        setEditingOrg(false);
        setSuccess('Organization updated successfully.');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error || 'Failed to update organization.');
      }
    } catch {
      setError('Failed to update organization.');
    } finally {
      setSaving(false);
    }
  };

  const openEntityForm = (entity?: Entity) => {
    if (entity) {
      setEditingEntity(entity);
      setEntityForm({
        name: entity.name,
        legal_name: entity.legal_name,
        entity_type: entity.entity_type,
        tax_id: entity.tax_id,
        address_line1: entity.address_line1 || '',
        address_line2: entity.address_line2 || '',
        city: entity.city || '',
        state: entity.state || '',
        zip: entity.zip || '',
      });
    } else {
      setEditingEntity(null);
      setEntityForm({
        name: '',
        legal_name: '',
        entity_type: 'LLC',
        tax_id: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        zip: '',
      });
    }
    setShowEntityForm(true);
  };

  const handleSaveEntity = async () => {
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const url = editingEntity
        ? `/api/entities/${editingEntity.id}`
        : '/api/entities';
      const method = editingEntity ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entityForm,
          user_id: user.id,
          organization_id: organization?.id,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setShowEntityForm(false);
        setEditingEntity(null);
        setSuccess(editingEntity ? 'Entity updated.' : 'Entity created.');
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      } else {
        setError(result.error || 'Failed to save entity.');
      }
    } catch {
      setError('Failed to save entity.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivateEntity = async (entityId: string) => {
    if (!confirm('Are you sure you want to deactivate this entity?')) return;
    try {
      const res = await fetch(`/api/entities/${entityId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'inactive' }),
      });
      const result = await res.json();
      if (result.success) {
        setSuccess('Entity deactivated.');
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      }
    } catch {
      setError('Failed to deactivate entity.');
    }
  };

  const toggleExpand = (entityId: string) => {
    setExpandedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  };

  const openLocationForm = (entityId: string, location?: Location) => {
    setShowLocationForm(entityId);
    if (location) {
      setEditingLocation(location);
      setLocationForm({
        name: location.name,
        address_line1: location.address_line1 || '',
        city: location.city || '',
        state: location.state || '',
        zip: location.zip || '',
        is_primary: location.is_primary,
      });
    } else {
      setEditingLocation(null);
      setLocationForm({
        name: '',
        address_line1: '',
        city: '',
        state: '',
        zip: '',
        is_primary: false,
      });
    }
  };

  const handleSaveLocation = async () => {
    if (!showLocationForm) return;
    setSaving(true);
    setError('');
    try {
      const url = editingLocation
        ? `/api/entities/${showLocationForm}/locations/${editingLocation.id}`
        : `/api/entities/${showLocationForm}/locations`;
      const method = editingLocation ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });
      const result = await res.json();
      if (result.success) {
        setShowLocationForm(null);
        setEditingLocation(null);
        setSuccess('Location saved.');
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      } else {
        setError(result.error || 'Failed to save location.');
      }
    } catch {
      setError('Failed to save location.');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userRoleId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/entities/user-roles/${userRoleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const result = await res.json();
      if (result.success) {
        setSuccess('Role updated.');
        setTimeout(() => setSuccess(''), 3000);
        await loadData();
      } else {
        setError(result.error || 'Failed to update role.');
      }
    } catch {
      setError('Failed to update role.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div>
        <nav className="text-sm text-corporate-gray mb-2">
          <Link href="/dashboard/settings" className="hover:text-primary-600">Settings</Link>
          <span className="mx-2">/</span>
          <span className="text-corporate-dark">Entity Management</span>
        </nav>
        <h1 className="text-2xl font-bold text-corporate-dark">Entity Management</h1>
      </div>

      {/* Notifications */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      {/* Organization Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-corporate-dark">Organization</h2>
          {!editingOrg && (
            <button onClick={() => setEditingOrg(true)} className="btn-secondary text-sm">
              Edit
            </button>
          )}
        </div>
        {editingOrg ? (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Organization Name</label>
              <input
                type="text"
                className="input-field"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <button onClick={handleSaveOrg} disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setEditingOrg(false); setOrgName(organization?.name || ''); }} className="btn-secondary">
              Cancel
            </button>
          </div>
        ) : (
          <p className="text-corporate-slate">{organization?.name || 'No organization set'}</p>
        )}
      </div>

      {/* Entities Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-corporate-dark">Entities</h2>
          <div className="flex gap-2">
            <Link href="/dashboard/settings/entities/intercompany" className="btn-secondary text-sm">
              Inter-company Transactions
            </Link>
            <button onClick={() => openEntityForm()} className="btn-primary text-sm">
              Add Entity
            </button>
          </div>
        </div>

        {/* Inline Entity Form */}
        {showEntityForm && (
          <div className="bg-corporate-light border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-md font-semibold text-corporate-dark mb-3">
              {editingEntity ? 'Edit Entity' : 'New Entity'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.name}
                  onChange={(e) => setEntityForm({ ...entityForm, name: e.target.value })}
                  placeholder="Display name"
                />
              </div>
              <div>
                <label className="label">Legal Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.legal_name}
                  onChange={(e) => setEntityForm({ ...entityForm, legal_name: e.target.value })}
                  placeholder="Full legal name"
                />
              </div>
              <div>
                <label className="label">Entity Type</label>
                <select
                  className="input-field"
                  value={entityForm.entity_type}
                  onChange={(e) => setEntityForm({ ...entityForm, entity_type: e.target.value })}
                >
                  {ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tax ID (EIN)</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.tax_id}
                  onChange={(e) => setEntityForm({ ...entityForm, tax_id: e.target.value })}
                  placeholder="XX-XXXXXXX"
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Address Line 1</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.address_line1}
                  onChange={(e) => setEntityForm({ ...entityForm, address_line1: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Address Line 2</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.address_line2}
                  onChange={(e) => setEntityForm({ ...entityForm, address_line2: e.target.value })}
                />
              </div>
              <div>
                <label className="label">City</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.city}
                  onChange={(e) => setEntityForm({ ...entityForm, city: e.target.value })}
                />
              </div>
              <div>
                <label className="label">State</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.state}
                  onChange={(e) => setEntityForm({ ...entityForm, state: e.target.value })}
                />
              </div>
              <div>
                <label className="label">ZIP Code</label>
                <input
                  type="text"
                  className="input-field"
                  value={entityForm.zip}
                  onChange={(e) => setEntityForm({ ...entityForm, zip: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setShowEntityForm(false); setEditingEntity(null); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleSaveEntity} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : editingEntity ? 'Update Entity' : 'Create Entity'}
              </button>
            </div>
          </div>
        )}

        {/* Entities Table */}
        {entities.length === 0 ? (
          <p className="text-corporate-gray text-center py-8">No entities yet. Add your first entity above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Tax ID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => (
                  <>
                    <tr key={entity.id}>
                      <td>
                        <button
                          onClick={() => toggleExpand(entity.id)}
                          className="text-corporate-gray hover:text-primary-600"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${expandedEntities.has(entity.id) ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td>
                        <div className="font-medium text-corporate-dark">{entity.name}</div>
                        {entity.legal_name && entity.legal_name !== entity.name && (
                          <div className="text-xs text-corporate-gray">{entity.legal_name}</div>
                        )}
                      </td>
                      <td className="text-corporate-slate">{entity.entity_type}</td>
                      <td className="text-corporate-slate font-mono text-sm">{entity.tax_id || '-'}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          entity.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {entity.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEntityForm(entity)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            Edit
                          </button>
                          {entity.status === 'active' && (
                            <button
                              onClick={() => handleDeactivateEntity(entity.id)}
                              className="text-red-600 hover:text-red-700 text-sm font-medium"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Locations Section */}
                    {expandedEntities.has(entity.id) && (
                      <tr key={`${entity.id}-locations`}>
                        <td colSpan={6} className="bg-corporate-light">
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-corporate-dark">
                                Locations for {entity.name}
                              </h4>
                              <button
                                onClick={() => openLocationForm(entity.id)}
                                className="btn-secondary text-xs"
                              >
                                Add Location
                              </button>
                            </div>

                            {/* Location Form */}
                            {showLocationForm === entity.id && (
                              <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="label">Location Name</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={locationForm.name}
                                      onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                                      placeholder="e.g. Main Office"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="label">Address</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={locationForm.address_line1}
                                      onChange={(e) => setLocationForm({ ...locationForm, address_line1: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="label">City</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={locationForm.city}
                                      onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="label">State</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={locationForm.state}
                                      onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                                    />
                                  </div>
                                  <div>
                                    <label className="label">ZIP</label>
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={locationForm.zip}
                                      onChange={(e) => setLocationForm({ ...locationForm, zip: e.target.value })}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mt-3">
                                  <label className="flex items-center gap-2 text-sm text-corporate-slate">
                                    <input
                                      type="checkbox"
                                      checked={locationForm.is_primary}
                                      onChange={(e) => setLocationForm({ ...locationForm, is_primary: e.target.checked })}
                                    />
                                    Primary location
                                  </label>
                                  <div className="flex-1"></div>
                                  <button
                                    onClick={() => { setShowLocationForm(null); setEditingLocation(null); }}
                                    className="btn-secondary text-xs"
                                  >
                                    Cancel
                                  </button>
                                  <button onClick={handleSaveLocation} disabled={saving} className="btn-primary text-xs">
                                    {saving ? 'Saving...' : editingLocation ? 'Update' : 'Add'}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Locations List */}
                            {(locations[entity.id] || []).length === 0 ? (
                              <p className="text-sm text-corporate-gray">No locations added yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {(locations[entity.id] || []).map((loc) => (
                                  <div
                                    key={loc.id}
                                    className="flex items-center justify-between bg-white rounded-md border border-gray-200 px-3 py-2"
                                  >
                                    <div>
                                      <span className="text-sm font-medium text-corporate-dark">
                                        {loc.name}
                                      </span>
                                      {loc.is_primary && (
                                        <span className="ml-2 text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded">
                                          Primary
                                        </span>
                                      )}
                                      <div className="text-xs text-corporate-gray">
                                        {[loc.address_line1, loc.city, loc.state, loc.zip].filter(Boolean).join(', ')}
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => openLocationForm(entity.id, loc)}
                                      className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Roles Section */}
      <div className="card">
        <h2 className="text-lg font-semibold text-corporate-dark mb-4">User Roles</h2>
        {userRoles.length === 0 ? (
          <p className="text-corporate-gray text-center py-8">No user roles configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Entity</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {userRoles.map((ur) => (
                  <tr key={ur.id}>
                    <td className="font-medium text-corporate-dark">{ur.user_name || '-'}</td>
                    <td className="text-corporate-slate">{ur.user_email}</td>
                    <td className="text-corporate-slate">{ur.entity_name}</td>
                    <td>
                      <select
                        className="input-field text-sm py-1"
                        value={ur.role}
                        onChange={(e) => handleRoleChange(ur.id, e.target.value)}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
