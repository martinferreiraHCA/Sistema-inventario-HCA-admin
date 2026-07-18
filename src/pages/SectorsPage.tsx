import { useState } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import Modal from '../components/Modal';
import type { Sector, Category, Product } from '../types';

export default function SectorsPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { data: sectors, loading } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const { data: products } = useCollection<Product>('products');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '' });
    setShowModal(true);
  }

  function openEdit(sector: Sector) {
    setEditing(sector);
    setForm({ name: sector.name, description: sector.description });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const duplicate = sectors.some(
      (s) => s.id !== editing?.id && s.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      showToast(`Ya existe un sector llamado "${name}"`, 'error');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDocument('sectors', editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
        });
      } else {
        await addDocument('sectors', {
          name: form.name.trim(),
          description: form.description.trim(),
          active: true,
        });
      }
      setShowModal(false);
      showToast(editing ? 'Sector actualizado' : 'Sector creado');
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar el sector', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(sector: Sector) {
    try {
      await updateDocument('sectors', sector.id, { active: !sector.active });
    } catch (err) {
      console.error(err);
      showToast('No se pudo cambiar el estado del sector', 'error');
    }
  }

  async function handleDelete(sector: Sector) {
    const categoryCount = categories.filter((c) => c.sectorId === sector.id).length;
    const productCount = products.filter((p) => p.sectorId === sector.id).length;
    if (categoryCount > 0 || productCount > 0) {
      showToast(
        `No se puede eliminar "${sector.name}": tiene ${categoryCount} categoria(s) y ${productCount} producto(s) asociados. Reasignalos o eliminalos primero, o desactiva el sector.`,
        'error'
      );
      return;
    }
    const ok = await confirm({
      title: 'Eliminar sector',
      message: `Se eliminara el sector "${sector.name}" de forma permanente.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDocument('sectors', sector.id);
      showToast('Sector eliminado');
    } catch (err) {
      console.error(err);
      showToast('No se pudo eliminar el sector', 'error');
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Sectores</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Nuevo Sector
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : sectors.length === 0 ? (
          <div className="empty-state">
            <Building2 size={48} />
            <p>No hay sectores creados</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Descripcion</th>
                  <th>Estado</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sectors.map((sector) => (
                  <tr key={sector.id}>
                    <td style={{ fontWeight: 600 }}>{sector.name}</td>
                    <td>{sector.description || '-'}</td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={sector.active}
                          onChange={() => handleToggleActive(sector)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => openEdit(sector)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(sector)}
                          style={{ color: 'var(--color-red)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Editar Sector' : 'Nuevo Sector'}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nombre del sector"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripcion</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripcion del sector"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
