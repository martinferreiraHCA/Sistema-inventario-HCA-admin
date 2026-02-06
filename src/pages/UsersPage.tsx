import { useState } from 'react';
import { Pencil, Users } from 'lucide-react';
import { useCollection, updateDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import type { AppUser, Sector, UserRole, ModulePermissions } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function UsersPage() {
  const { appUser: currentUser } = useAuth();
  const { data: users, loading } = useCollection<AppUser>('users');
  const { data: sectors } = useCollection<Sector>('sectors');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    role: 'usuario' as UserRole,
    assignedSectors: [] as string[],
    active: true,
  });

  const activeSectors = sectors.filter((s) => s.active);

  function openEdit(user: AppUser) {
    setEditing(user);
    setForm({
      role: user.role,
      assignedSectors: user.assignedSectors || [],
      active: user.active,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      // Fetch current role config to get permissions
      const roleConfigRef = doc(db, 'roleConfigs', form.role);
      const roleConfigSnap = await getDoc(roleConfigRef);
      let permissions: ModulePermissions;

      if (roleConfigSnap.exists()) {
        permissions = roleConfigSnap.data().permissions as ModulePermissions;
      } else {
        permissions = { ...DEFAULT_PERMISSIONS[form.role] };
      }

      await updateDocument('users', editing.uid, {
        role: form.role,
        assignedSectors: form.assignedSectors,
        active: form.active,
        permissions,
      });
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function toggleSector(sectorId: string) {
    setForm((prev) => ({
      ...prev,
      assignedSectors: prev.assignedSectors.includes(sectorId)
        ? prev.assignedSectors.filter((id) => id !== sectorId)
        : [...prev.assignedSectors, sectorId],
    }));
  }

  function getRoleBadge(role: UserRole) {
    switch (role) {
      case 'admin':
        return <span className="badge badge-red">Administrador</span>;
      case 'gestor':
        return <span className="badge badge-blue">Gestor</span>;
      default:
        return <span className="badge badge-gray">Usuario</span>;
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Usuarios</h1>
      </div>

      <div className="alert alert-info">
        Los usuarios se crean automaticamente cuando inician sesion con su cuenta @hca.edu.uy.
        Debes activarlos y asignarles un rol y sectores para que puedan acceder al sistema.
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Sectores Asignados</th>
                  <th>Estado</th>
                  <th style={{ width: 80 }}>Editar</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.uid}>
                    <td style={{ fontWeight: 600 }}>{user.displayName}</td>
                    <td style={{ fontSize: '0.85rem' }}>{user.email}</td>
                    <td>{getRoleBadge(user.role)}</td>
                    <td>
                      <div className="chips-container">
                        {user.assignedSectors.length > 0 ? (
                          user.assignedSectors.map((sid) => (
                            <span key={sid} className="chip">
                              {sectors.find((s) => s.id === sid)?.name || sid}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--color-text-light)', fontSize: '0.8rem' }}>
                            {user.role === 'admin' ? 'Acceso total' : 'Sin sectores'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={user.active}
                          onChange={async () => {
                            await updateDocument('users', user.uid, { active: !user.active });
                          }}
                          disabled={user.uid === currentUser?.uid}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => openEdit(user)}>
                        <Pencil size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && editing && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Usuario</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ marginBottom: 20, padding: 16, background: 'var(--color-bg-secondary)', borderRadius: 8 }}>
                  <p style={{ fontWeight: 600 }}>{editing.displayName}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                    {editing.email}
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select
                    className="form-select"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                  >
                    <option value="admin">Administrador</option>
                    <option value="gestor">Gestor</option>
                    <option value="usuario">Usuario</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Activo</label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => setForm({ ...form, active: e.target.checked })}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>

                {form.role !== 'admin' && (
                  <div className="form-group">
                    <label className="form-label">Sectores Asignados</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                      Selecciona los sectores a los que el usuario podra acceder.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {activeSectors.map((sector) => (
                        <label
                          key={sector.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            background: form.assignedSectors.includes(sector.id)
                              ? 'rgba(36, 43, 89, 0.05)'
                              : 'white',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={form.assignedSectors.includes(sector.id)}
                            onChange={() => toggleSector(sector.id)}
                          />
                          <span style={{ fontWeight: 500 }}>{sector.name}</span>
                        </label>
                      ))}
                      {activeSectors.length === 0 && (
                        <p style={{ color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                          No hay sectores activos. Crea sectores primero.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
