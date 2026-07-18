import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument, registerStockMovement } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/format';
import type { Product, Sector, Category } from '../types';

export default function ProductsPage() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { data: products, loading } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSector, setFilterSector] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    sectorId: '',
    categoryId: '',
    stock: 0,
    minStock: 0,
    unit: 'unidades',
    cost: 0,
  });

  const activeSectors = sectors.filter((s) => s.active);
  const activeCategories = categories.filter((c) => c.active);
  const sectorNameById = useMemo(() => new Map(sectors.map((s) => [s.id, s.name])), [sectors]);
  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const filteredCategories = form.sectorId
    ? activeCategories.filter((c) => c.sectorId === form.sectorId)
    : activeCategories;

  const filteredProducts = useMemo(() => {
    let result = products;
    if (filterSector) result = result.filter((p) => p.sectorId === filterSector);
    if (filterCategory) result = result.filter((p) => p.categoryId === filterCategory);
    if (onlyLowStock) result = result.filter((p) => p.stock <= p.minStock && p.active);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, filterSector, filterCategory, searchQuery, onlyLowStock]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: '',
      description: '',
      sectorId: activeSectors[0]?.id || '',
      categoryId: '',
      stock: 0,
      minStock: 0,
      unit: 'unidades',
      cost: 0,
    });
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description,
      sectorId: product.sectorId,
      categoryId: product.categoryId,
      stock: product.stock,
      minStock: product.minStock,
      unit: product.unit,
      cost: product.cost,
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.sectorId) return;

    const name = form.name.trim();
    const duplicate = products.some(
      (p) =>
        p.id !== editing?.id &&
        p.sectorId === form.sectorId &&
        p.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      showToast(`Ya existe un producto llamado "${name}" en este sector`, 'error');
      return;
    }

    const stock = Number(form.stock);
    const minStock = Number(form.minStock);
    const cost = Number(form.cost);
    if ([stock, minStock, cost].some((n) => !Number.isFinite(n) || n < 0)) {
      showToast('Stock, stock minimo y costo deben ser numeros mayores o iguales a 0', 'error');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name,
        description: form.description.trim(),
        sectorId: form.sectorId,
        categoryId: form.categoryId,
        minStock,
        unit: form.unit,
        cost,
      };

      if (editing) {
        await updateDocument('products', editing.id, data);
        // Si cambio el stock, registrarlo como ajuste para no perder el historial
        if (stock !== editing.stock) {
          await registerStockMovement({
            productId: editing.id,
            type: 'adjustment',
            quantity: stock,
            reason: 'Ajuste desde edicion de producto',
            userId: appUser?.uid || '',
            userEmail: appUser?.email || '',
          });
        }
        showToast('Producto actualizado');
      } else {
        await addDocument('products', { ...data, stock, active: true });
        showToast('Producto creado');
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar el producto', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(product: Product) {
    try {
      await updateDocument('products', product.id, { active: !product.active });
    } catch (err) {
      console.error(err);
      showToast('No se pudo cambiar el estado del producto', 'error');
    }
  }

  async function handleDelete(product: Product) {
    const ok = await confirm({
      title: 'Eliminar producto',
      message: `Se eliminara "${product.name}" de forma permanente. El historial de movimientos se conserva, pero el producto no podra recuperarse.\n\nSi solo quieres dejar de usarlo, desactivalo con el interruptor de estado.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDocument('products', product.id);
      showToast('Producto eliminado');
    } catch (err) {
      console.error(err);
      showToast('No se pudo eliminar el producto', 'error');
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Productos</h1>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: 350 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-light)',
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterSector}
          onChange={(e) => {
            setFilterSector(e.target.value);
            setFilterCategory('');
          }}
        >
          <option value="">Todos los sectores</option>
          {activeSectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {(filterSector
            ? activeCategories.filter((c) => c.sectorId === filterSector)
            : activeCategories
          ).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '0 4px',
          }}
        >
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
          />
          <AlertTriangle size={15} color="var(--color-warning)" />
          Solo stock bajo
        </label>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="empty-state">
            <Package size={48} />
            <p>No hay productos</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Sector</th>
                  <th>Categoria</th>
                  <th>Stock</th>
                  <th>Min.</th>
                  <th>Costo</th>
                  <th>Estado</th>
                  <th style={{ width: 120 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const isLow = product.stock <= product.minStock && product.active;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600 }}>{product.name}</div>
                          {product.description && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                              {product.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-blue">
                          {sectorNameById.get(product.sectorId) || '-'}
                        </span>
                      </td>
                      <td>{categoryNameById.get(product.categoryId) || '-'}</td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-red' : 'badge-green'}`}>
                          {product.stock} {product.unit}
                        </span>
                      </td>
                      <td>{product.minStock} {product.unit}</td>
                      <td>{formatCurrency(product.cost)}</td>
                      <td>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={product.active}
                            onChange={() => handleToggleActive(product)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn-icon" onClick={() => openEdit(product)}>
                            <Pencil size={16} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleDelete(product)}
                            style={{ color: 'var(--color-red)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          title={editing ? 'Editar Producto' : 'Nuevo Producto'}
          onClose={() => setShowModal(false)}
          maxWidth={640}
        >
          <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Sector</label>
                    <select
                      className="form-select"
                      value={form.sectorId}
                      onChange={(e) => setForm({ ...form, sectorId: e.target.value, categoryId: '' })}
                      required
                    >
                      <option value="">Seleccionar</option>
                      {activeSectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select
                      className="form-select"
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                    >
                      <option value="">Seleccionar</option>
                      {filteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Nombre del producto"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripcion</label>
                  <textarea
                    className="form-textarea"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Descripcion del producto"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Stock</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={form.stock}
                      onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    />
                    {editing && form.stock !== editing.stock && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-warning)', marginTop: 4 }}>
                        Se registrara como ajuste en el historial
                      </p>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Min.</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={form.minStock}
                      onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unidad</label>
                    <select
                      className="form-select"
                      value={form.unit}
                      onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    >
                      <option value="unidades">Unidades</option>
                      <option value="kg">Kg</option>
                      <option value="litros">Litros</option>
                      <option value="metros">Metros</option>
                      <option value="cajas">Cajas</option>
                      <option value="paquetes">Paquetes</option>
                      <option value="resmas">Resmas</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Costo ($)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.cost}
                      onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                    />
                  </div>
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
