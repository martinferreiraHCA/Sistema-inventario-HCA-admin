import { useState, useMemo } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Sector, Category, StockMovement } from '../types';

export default function StockPage() {
  const { appUser } = useAuth();
  const { data: movements, loading } = useCollection<StockMovement>('stockMovements');
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters for the history table
  const [filterSector, setFilterSector] = useState('');
  const [filterType, setFilterType] = useState('');

  // Filters for the modal product selector
  const [modalSector, setModalSector] = useState('');
  const [modalCategory, setModalCategory] = useState('');

  const [form, setForm] = useState({
    productId: '',
    type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: 0,
    reason: '',
  });

  const activeSectors = sectors.filter((s) => s.active);
  const activeCategories = categories.filter((c) => c.active);

  // Products filtered by sector and category in the modal
  const modalProducts = useMemo(() => {
    let result = products.filter((p) => p.active);
    if (modalSector) result = result.filter((p) => p.sectorId === modalSector);
    if (modalCategory) result = result.filter((p) => p.categoryId === modalCategory);
    return result;
  }, [products, modalSector, modalCategory]);

  // Categories filtered by selected sector in the modal
  const modalFilteredCategories = useMemo(() => {
    if (!modalSector) return activeCategories;
    return activeCategories.filter((c) => c.sectorId === modalSector);
  }, [activeCategories, modalSector]);

  // Movements filtered by sector and type
  const filteredMovements = useMemo(() => {
    let result = [...movements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filterSector) result = result.filter((m) => m.sectorId === filterSector);
    if (filterType) result = result.filter((m) => m.type === filterType);
    return result;
  }, [movements, filterSector, filterType]);

  function openModal() {
    setModalSector('');
    setModalCategory('');
    setForm({ productId: '', type: 'in', quantity: 0, reason: '' });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productId || form.quantity <= 0) return;
    setSaving(true);
    try {
      const product = products.find((p) => p.id === form.productId);
      if (!product) return;

      let newStock = product.stock;
      if (form.type === 'in') newStock += form.quantity;
      else if (form.type === 'out') newStock = Math.max(0, newStock - form.quantity);
      else newStock = form.quantity;

      await addDocument('stockMovements', {
        productId: form.productId,
        productName: product.name,
        sectorId: product.sectorId,
        type: form.type,
        quantity: form.quantity,
        previousStock: product.stock,
        newStock,
        reason: form.reason.trim(),
        userId: appUser?.uid || '',
        userEmail: appUser?.email || '',
      });

      await updateDocument('products', form.productId, {
        stock: newStock,
        lastModifiedBy: appUser?.email || '',
        lastModifiedAt: new Date().toISOString(),
      });

      setShowModal(false);
      setForm({ productId: '', type: 'in', quantity: 0, reason: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'in':
        return <ArrowUpCircle size={16} color="#0C5F55" />;
      case 'out':
        return <ArrowDownCircle size={16} color="#BF1818" />;
      default:
        return <RefreshCw size={16} color="#ED8B0D" />;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'in': return 'Entrada';
      case 'out': return 'Salida';
      default: return 'Ajuste';
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Movimientos de Stock</h1>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={18} /> Nuevo Movimiento
        </button>
      </div>

      {/* History Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
        >
          <option value="">Todos los sectores</option>
          {activeSectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          <option value="in">Entradas</option>
          <option value="out">Salidas</option>
          <option value="adjustment">Ajustes</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : filteredMovements.length === 0 ? (
          <div className="empty-state">
            <RefreshCw size={48} />
            <p>No hay movimientos registrados</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Sector</th>
                  <th>Cantidad</th>
                  <th>Stock Ant.</th>
                  <th>Stock Nuevo</th>
                  <th>Razon</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((mov) => (
                  <tr key={mov.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {getTypeIcon(mov.type)}
                        <span className={`badge ${
                          mov.type === 'in' ? 'badge-green' : mov.type === 'out' ? 'badge-red' : 'badge-orange'
                        }`}>
                          {getTypeLabel(mov.type)}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{mov.productName}</td>
                    <td>{sectors.find((s) => s.id === mov.sectorId)?.name || '-'}</td>
                    <td>{mov.quantity}</td>
                    <td>{mov.previousStock}</td>
                    <td>{mov.newStock}</td>
                    <td>{mov.reason || '-'}</td>
                    <td style={{ fontSize: '0.8rem' }}>{mov.userEmail}</td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {new Date(mov.createdAt).toLocaleDateString('es-UY', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
              <h2>Nuevo Movimiento de Stock</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Step 1: Sector and Category filters */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Sector</label>
                    <select
                      className="form-select"
                      value={modalSector}
                      onChange={(e) => {
                        setModalSector(e.target.value);
                        setModalCategory('');
                        setForm({ ...form, productId: '' });
                      }}
                    >
                      <option value="">Todos los sectores</option>
                      {activeSectors.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Categoria</label>
                    <select
                      className="form-select"
                      value={modalCategory}
                      onChange={(e) => {
                        setModalCategory(e.target.value);
                        setForm({ ...form, productId: '' });
                      }}
                    >
                      <option value="">Todas las categorias</option>
                      {modalFilteredCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 2: Product selector */}
                <div className="form-group">
                  <label className="form-label">Producto</label>
                  {modalProducts.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '10px 0' }}>
                      {modalSector
                        ? 'No hay productos en este sector/categoria'
                        : 'Selecciona un sector para ver los productos'}
                    </p>
                  ) : (
                    <select
                      className="form-select"
                      value={form.productId}
                      onChange={(e) => setForm({ ...form, productId: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar producto</option>
                      {modalProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Stock: {p.stock} {p.unit})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Selected product info */}
                {form.productId && (() => {
                  const selected = products.find((p) => p.id === form.productId);
                  if (!selected) return null;
                  return (
                    <div style={{
                      padding: 12,
                      background: 'var(--color-bg-secondary)',
                      borderRadius: 8,
                      marginBottom: 16,
                      fontSize: '0.85rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong>{selected.name}</strong></span>
                        <span className="badge badge-blue">
                          Stock actual: {selected.stock} {selected.unit}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="form-group">
                  <label className="form-label">Tipo de Movimiento</label>
                  <select
                    className="form-select"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'in' | 'out' | 'adjustment' })}
                  >
                    <option value="in">Entrada (sumar stock)</option>
                    <option value="out">Salida (restar stock)</option>
                    <option value="adjustment">Ajuste (establecer stock)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {form.type === 'adjustment' ? 'Nuevo Stock' : 'Cantidad'}
                  </label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Razon / Observacion</label>
                  <textarea
                    className="form-textarea"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    placeholder="Motivo del movimiento"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.productId}>
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
