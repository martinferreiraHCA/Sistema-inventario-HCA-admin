import { useState, useMemo } from 'react';
import { Plus, Eye, Check, XCircle, Truck, ClipboardList } from 'lucide-react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import type { Order, OrderItem, Product, Sector } from '../types';

export default function OrdersPage() {
  const { appUser } = useAuth();
  const { data: orders, loading } = useCollection<Order>('orders');
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const isManager = appUser?.role === 'admin' || appUser?.role === 'gestor';

  const [form, setForm] = useState({
    sectorId: '',
    notes: '',
    items: [] as OrderItem[],
  });
  const [itemForm, setItemForm] = useState({ productId: '', quantity: 1 });

  const userSectors = isManager
    ? sectors.filter((s) => s.active)
    : sectors.filter((s) => s.active && appUser?.assignedSectors.includes(s.id));

  const availableProducts = products.filter(
    (p) => p.active && p.sectorId === form.sectorId
  );

  const filteredOrders = useMemo(() => {
    let result = [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (!isManager) {
      result = result.filter((o) => o.userId === appUser?.uid);
    }
    if (filterStatus) {
      result = result.filter((o) => o.status === filterStatus);
    }
    return result;
  }, [orders, isManager, appUser, filterStatus]);

  function addItem() {
    if (!itemForm.productId || itemForm.quantity <= 0) return;
    const product = products.find((p) => p.id === itemForm.productId);
    if (!product) return;
    if (form.items.find((i) => i.productId === itemForm.productId)) return;
    setForm({
      ...form,
      items: [
        ...form.items,
        {
          productId: product.id,
          productName: product.name,
          quantity: itemForm.quantity,
          unit: product.unit,
        },
      ],
    });
    setItemForm({ productId: '', quantity: 1 });
  }

  function removeItem(productId: string) {
    setForm({ ...form, items: form.items.filter((i) => i.productId !== productId) });
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sectorId || form.items.length === 0) return;
    setSaving(true);
    try {
      const sector = sectors.find((s) => s.id === form.sectorId);
      await addDocument('orders', {
        userId: appUser?.uid,
        userEmail: appUser?.email,
        userName: appUser?.displayName,
        sectorId: form.sectorId,
        sectorName: sector?.name || '',
        items: form.items,
        status: 'pending',
        notes: form.notes.trim(),
        responseNotes: '',
      });
      setShowCreateModal(false);
      setForm({ sectorId: '', notes: '', items: [] });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(orderId: string, status: string, responseNotes?: string) {
    await updateDocument('orders', orderId, {
      status,
      responseNotes: responseNotes || '',
    });

    if (status === 'delivered') {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        for (const item of order.items) {
          const product = products.find((p) => p.id === item.productId);
          if (product) {
            const newStock = Math.max(0, product.stock - item.quantity);
            await updateDocument('products', item.productId, { stock: newStock });
          }
        }
      }
    }

    setShowDetailModal(false);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <span className="badge badge-orange">Pendiente</span>;
      case 'approved':
        return <span className="badge badge-blue">Aprobado</span>;
      case 'rejected':
        return <span className="badge badge-red">Rechazado</span>;
      case 'delivered':
        return <span className="badge badge-green">Entregado</span>;
      default:
        return <span className="badge badge-gray">{status}</span>;
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Pedidos</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> Nuevo Pedido
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: 20 }}>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
          <option value="delivered">Entregados</option>
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <p>No hay pedidos</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  {isManager && <th>Solicitante</th>}
                  <th>Sector</th>
                  <th>Items</th>
                  <th>Estado</th>
                  <th>Notas</th>
                  <th style={{ width: 80 }}>Ver</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td style={{ fontSize: '0.8rem' }}>
                      {new Date(order.createdAt).toLocaleDateString('es-UY', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    {isManager && <td style={{ fontSize: '0.85rem' }}>{order.userName}</td>}
                    <td>
                      <span className="badge badge-blue">{order.sectorName}</span>
                    </td>
                    <td>{order.items.length} items</td>
                    <td>{getStatusBadge(order.status)}</td>
                    <td style={{ fontSize: '0.8rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.notes || '-'}
                    </td>
                    <td>
                      <button
                        className="btn-icon"
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailModal(true);
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>Nuevo Pedido</h2>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateOrder}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Sector</label>
                  <select
                    className="form-select"
                    value={form.sectorId}
                    onChange={(e) => setForm({ ...form, sectorId: e.target.value, items: [] })}
                    required
                  >
                    <option value="">Seleccionar sector</option>
                    {userSectors.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {form.sectorId && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Agregar Producto</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <select
                          className="form-select"
                          value={itemForm.productId}
                          onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })}
                          style={{ flex: 1 }}
                        >
                          <option value="">Seleccionar producto</option>
                          {availableProducts
                            .filter((p) => !form.items.find((i) => i.productId === p.id))
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} (Disp: {p.stock} {p.unit})
                              </option>
                            ))}
                        </select>
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          value={itemForm.quantity}
                          onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
                          style={{ width: 80 }}
                        />
                        <button type="button" className="btn btn-secondary" onClick={addItem}>
                          Agregar
                        </button>
                      </div>
                    </div>

                    {form.items.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <table>
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Cantidad</th>
                              <th style={{ width: 40 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {form.items.map((item) => (
                              <tr key={item.productId}>
                                <td>{item.productName}</td>
                                <td>{item.quantity} {item.unit}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => removeItem(item.productId)}
                                    style={{ color: 'var(--color-red)' }}
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Notas</label>
                  <textarea
                    className="form-textarea"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Notas o comentarios adicionales"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || form.items.length === 0}
                >
                  {saving ? 'Enviando...' : 'Enviar Pedido'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2>Detalle del Pedido</h2>
              <button className="btn-icon" onClick={() => setShowDetailModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div>
                  <div className="form-label">Solicitante</div>
                  <p style={{ fontSize: '0.9rem' }}>{selectedOrder.userName}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {selectedOrder.userEmail}
                  </p>
                </div>
                <div>
                  <div className="form-label">Sector</div>
                  <span className="badge badge-blue">{selectedOrder.sectorName}</span>
                </div>
                <div>
                  <div className="form-label">Fecha</div>
                  <p style={{ fontSize: '0.9rem' }}>
                    {new Date(selectedOrder.createdAt).toLocaleDateString('es-UY', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div>
                  <div className="form-label">Estado</div>
                  {getStatusBadge(selectedOrder.status)}
                </div>
              </div>

              <div className="form-label">Productos solicitados</div>
              <table style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item) => (
                    <tr key={item.productId}>
                      <td>{item.productName}</td>
                      <td>{item.quantity} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {selectedOrder.notes && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">Notas del solicitante</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {selectedOrder.notes}
                  </p>
                </div>
              )}

              {selectedOrder.responseNotes && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">Respuesta</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {selectedOrder.responseNotes}
                  </p>
                </div>
              )}
            </div>

            {isManager && selectedOrder.status === 'pending' && (
              <div className="modal-footer">
                <button
                  className="btn btn-danger"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'rejected')}
                >
                  <XCircle size={16} /> Rechazar
                </button>
                <button
                  className="btn btn-success"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'approved')}
                >
                  <Check size={16} /> Aprobar
                </button>
              </div>
            )}

            {isManager && selectedOrder.status === 'approved' && (
              <div className="modal-footer">
                <button
                  className="btn btn-primary"
                  onClick={() => handleUpdateStatus(selectedOrder.id, 'delivered')}
                >
                  <Truck size={16} /> Marcar como Entregado
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
