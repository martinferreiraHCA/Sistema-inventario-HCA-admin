import { useState } from 'react';
import { Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Sector, StockMovement } from '../types';

export default function StockPage() {
  const { appUser } = useAuth();
  const { data: movements, loading } = useCollection<StockMovement>('stockMovements');
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    productId: '',
    type: 'in' as 'in' | 'out' | 'adjustment',
    quantity: 0,
    reason: '',
  });

  const activeProducts = products.filter((p) => p.active);

  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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

      await updateDocument('products', form.productId, { stock: newStock });

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
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Nuevo Movimiento
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : sortedMovements.length === 0 ? (
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
                {sortedMovements.map((mov) => (
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
                <div className="form-group">
                  <label className="form-label">Producto</label>
                  <select
                    className="form-select"
                    value={form.productId}
                    onChange={(e) => setForm({ ...form, productId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar producto</option>
                    {activeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo de Movimiento</label>
                  <select
                    className="form-select"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as any })}
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
                <button type="submit" className="btn btn-primary" disabled={saving}>
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
