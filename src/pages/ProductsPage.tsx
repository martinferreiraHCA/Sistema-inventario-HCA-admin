import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Package, Search } from 'lucide-react';
import { useCollection, addDocument, updateDocument, deleteDocument } from '../hooks/useFirestore';
import type { Product, Sector, Category } from '../types';

export default function ProductsPage() {
  const { data: products, loading } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSector, setFilterSector] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

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

  const filteredCategories = form.sectorId
    ? activeCategories.filter((c) => c.sectorId === form.sectorId)
    : activeCategories;

  const filteredProducts = useMemo(() => {
    let result = products;
    if (filterSector) result = result.filter((p) => p.sectorId === filterSector);
    if (filterCategory) result = result.filter((p) => p.categoryId === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [products, filterSector, filterCategory, searchQuery]);

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
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        description: form.description.trim(),
        sectorId: form.sectorId,
        categoryId: form.categoryId,
        stock: Number(form.stock),
        minStock: Number(form.minStock),
        unit: form.unit,
        cost: Number(form.cost),
      };

      if (editing) {
        await updateDocument('products', editing.id, data);
      } else {
        await addDocument('products', { ...data, active: true });
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(product: Product) {
    await updateDocument('products', product.id, { active: !product.active });
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Eliminar producto "${product.name}"?`)) return;
    await deleteDocument('products', product.id);
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
                          {sectors.find((s) => s.id === product.sectorId)?.name || '-'}
                        </span>
                      </td>
                      <td>{categories.find((c) => c.id === product.categoryId)?.name || '-'}</td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-red' : 'badge-green'}`}>
                          {product.stock} {product.unit}
                        </span>
                      </td>
                      <td>{product.minStock} {product.unit}</td>
                      <td>${product.cost.toFixed(2)}</td>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>{editing ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
