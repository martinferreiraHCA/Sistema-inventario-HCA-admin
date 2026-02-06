import { useState, useEffect } from 'react';
import { Shield, Save } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useCollection, updateDocument } from '../hooks/useFirestore';
import type { ModulePermissions, UserRole, AppUser } from '../types';
import { DEFAULT_PERMISSIONS } from '../types';

const MODULE_LABELS: Record<keyof ModulePermissions, string> = {
  dashboard: 'Dashboard',
  sectors: 'Sectores',
  categories: 'Categorias',
  products: 'Productos',
  stock: 'Movimientos de Stock',
  costs: 'Costos',
  orders: 'Pedidos',
  users: 'Gestion de Usuarios',
  roles: 'Configuracion de Roles',
  reports: 'Reportes',
};

const ROLES: { key: UserRole; label: string }[] = [
  { key: 'gestor', label: 'Gestor' },
  { key: 'usuario', label: 'Usuario' },
];

export default function RolesPage() {
  const { data: users } = useCollection<AppUser>('users');
  const [roleConfigs, setRoleConfigs] = useState<Record<string, ModulePermissions>>({
    gestor: { ...DEFAULT_PERMISSIONS.gestor },
    usuario: { ...DEFAULT_PERMISSIONS.usuario },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadConfigs() {
      for (const role of ROLES) {
        const ref = doc(db, 'roleConfigs', role.key);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setRoleConfigs((prev) => ({
            ...prev,
            [role.key]: snap.data().permissions as ModulePermissions,
          }));
        }
      }
    }
    loadConfigs();
  }, []);

  function togglePermission(role: UserRole, module: keyof ModulePermissions) {
    setRoleConfigs((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: !prev[role][module],
      },
    }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const role of ROLES) {
        const ref = doc(db, 'roleConfigs', role.key);
        await setDoc(ref, {
          role: role.key,
          label: role.label,
          permissions: roleConfigs[role.key],
          updatedAt: new Date().toISOString(),
        });

        // Update all users with this role
        const usersWithRole = users.filter((u) => u.role === role.key);
        for (const user of usersWithRole) {
          await updateDocument('users', user.uid, {
            permissions: roleConfigs[role.key],
          });
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Configuracion de Roles</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {saved && (
        <div className="alert alert-success">
          Configuracion guardada correctamente. Los permisos se actualizaron para todos los usuarios.
        </div>
      )}

      <div className="alert alert-info">
        Configura que modulos estan habilitados para cada rol. Los administradores siempre tienen
        acceso a todos los modulos. Los cambios se aplican a todos los usuarios con ese rol.
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 240 }}>Modulo</th>
                <th style={{ textAlign: 'center' }}>
                  <span className="badge badge-red" style={{ display: 'inline-block' }}>Admin</span>
                </th>
                {ROLES.map((role) => (
                  <th key={role.key} style={{ textAlign: 'center' }}>
                    <span
                      className={`badge ${role.key === 'gestor' ? 'badge-blue' : 'badge-gray'}`}
                      style={{ display: 'inline-block' }}
                    >
                      {role.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(MODULE_LABELS) as (keyof ModulePermissions)[]).map((module) => (
                <tr key={module}>
                  <td style={{ fontWeight: 600 }}>
                    {MODULE_LABELS[module]}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <label className="toggle" style={{ display: 'inline-block' }}>
                      <input type="checkbox" checked={true} disabled />
                      <span className="toggle-slider" />
                    </label>
                  </td>
                  {ROLES.map((role) => (
                    <td key={role.key} style={{ textAlign: 'center' }}>
                      <label className="toggle" style={{ display: 'inline-block' }}>
                        <input
                          type="checkbox"
                          checked={roleConfigs[role.key]?.[module] || false}
                          onChange={() => togglePermission(role.key, module)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginTop: 24 }}>
        {ROLES.map((role) => {
          const enabledCount = Object.values(roleConfigs[role.key] || {}).filter(Boolean).length;
          const totalCount = Object.keys(MODULE_LABELS).length;
          return (
            <div className="card" key={role.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Shield size={20} color="var(--color-blue)" />
                <h3 style={{ fontSize: '1rem', margin: 0 }}>{role.label}</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                {enabledCount} de {totalCount} modulos habilitados
              </p>
              <div
                style={{
                  height: 6,
                  background: 'var(--color-bg-secondary)',
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${(enabledCount / totalCount) * 100}%`,
                    background: 'var(--color-blue)',
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: 8 }}>
                {users.filter((u) => u.role === role.key).length} usuarios con este rol
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
