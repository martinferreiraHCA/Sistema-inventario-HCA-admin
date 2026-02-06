import { useState } from 'react';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import type { Category, Sector } from '../types';

export default function CategoriesPage() {
  const { data: categories, loading } = useCollection<Category>('categories');
  const { data: sectors } = useCollection<Sector>('sectors');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '', sectorId: '' });
  const [saving, setSaving] = useState(false);
  const [filterSector, setFilterSector] = useState('');

  const activeSectors = sectors.filter((s) => s.active);

  const filteredCategories = filterSector
    ? categories.filter((c) => c.sectorId === filterSector)
    : categories;

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', sectorId: activeSectors[0]?.id || '' });
    setShowModal(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description, sectorId: cat.sectorId });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.sectorId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDocument('categories', editing.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          sectorId: form.sectorId,
        });
      } else {
        await addDocument('categories', {
          name: form.name.trim(),
          description: form.description.trim(),
          sectorId: form.sectorId,
          active: true,
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(cat: Category) {
    await updateDocument('categories', cat.id, { active: !cat.active });
  }

  async function handleDelete(cat: Category) {
    if (!confirm(`Eliminar categoria "${cat.name}"?`)) return;
    await deleteDocument('categories', cat.id);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Categorias</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Nueva Categoria
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 20 }}>
        <select
          className="form-select"
          style={{ maxWidth: 300 }}
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
        >
          <option value="">Todos los sectores</option>
          {activeSectors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : filteredCategories.length === 0 ? (
          <div className="empty-state">
            <FolderTree size={48} />
            <p>No hay categorias creadas</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Sector</th>
                  <th>Descripcion</th>
                  <th>Estado</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCategories.map((cat) => (
                  <tr key={cat.id}>
                    <td style={{ fontWeight: 600 }}>{cat.name}</td>
                    <td>
                      <span className="badge badge-blue">
                        {sectors.find((s) => s.id === cat.sectorId)?.name || '-'}
                      </span>
                    </td>
                    <td>{cat.description || '-'}</td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={cat.active}
                          onChange={() => handleToggleActive(cat)}
                        />
                        <span className="toggle-slider" />
                      </label>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => openEdit(cat)}>
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(cat)}
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Editar Categoria' : 'Nueva Categoria'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Sector</label>
                  <select
                    className="form-select"
                    value={form.sectorId}
                    onChange={(e) => setForm({ ...form, sectorId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar sector</option>
                    {activeSectors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nombre de la categoria"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripcion</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripcion de la categoria"
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
          </div>
        </div>
      )}
    </div>
  );
}
