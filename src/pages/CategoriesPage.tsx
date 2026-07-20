import { useState } from 'react';
import { Plus, Pencil, Trash2, FolderTree } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import Modal from '../components/Modal';
import type { Category, Sector, Product } from '../types';

export default function CategoriesPage() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { data: categories, loading } = useCollection<Category>('categories');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: products, loading: loadingProducts } = useCollection<Product>('products');
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
    const name = form.name.trim();
    if (!name || !form.sectorId) return;
    // Solo validar duplicados si cambio el nombre o el sector
    const changedKey =
      !editing ||
      editing.name.trim().toLowerCase() !== name.toLowerCase() ||
      editing.sectorId !== form.sectorId;
    const duplicate =
      changedKey &&
      categories.some(
        (c) =>
          c.id !== editing?.id &&
          c.sectorId === form.sectorId &&
          c.name.trim().toLowerCase() === name.toLowerCase()
      );
    if (duplicate) {
      showToast(`Ya existe una categoria llamada "${name}" en este sector`, 'error');
      return;
    }
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
      showToast(editing ? 'Categoria actualizada' : 'Categoria creada');
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar la categoria', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(cat: Category) {
    try {
      await updateDocument('categories', cat.id, { active: !cat.active });
    } catch (err) {
      console.error(err);
      showToast('No se pudo cambiar el estado de la categoria', 'error');
    }
  }

  async function handleDelete(cat: Category) {
    // Sin los productos cargados el chequeo de referencias pasaria en falso
    if (loadingProducts) {
      showToast('Cargando datos, intenta de nuevo en unos segundos', 'info');
      return;
    }
    const productCount = products.filter((p) => p.categoryId === cat.id).length;
    if (productCount > 0) {
      showToast(
        `No se puede eliminar "${cat.name}": tiene ${productCount} producto(s) asociados. Reasignalos o eliminalos primero, o desactiva la categoria.`,
        'error'
      );
      return;
    }
    const ok = await confirm({
      title: 'Eliminar categoria',
      message: `Se eliminara la categoria "${cat.name}" de forma permanente.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDocument('categories', cat.id);
      showToast('Categoria eliminada');
    } catch (err) {
      console.error(err);
      showToast('No se pudo eliminar la categoria', 'error');
    }
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
        <Modal
          title={editing ? 'Editar Categoria' : 'Nueva Categoria'}
          onClose={() => setShowModal(false)}
        >
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
        </Modal>
      )}
    </div>
  );
}
