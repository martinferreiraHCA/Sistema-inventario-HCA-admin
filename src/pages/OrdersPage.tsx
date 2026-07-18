import { useState, useMemo } from 'react';
import { Plus, Eye, Check, XCircle, Truck, ClipboardList } from 'lucide-react';
import { useCollection, addDocument, updateDocument, registerStockMovement } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';
import { formatDate, formatDateTime } from '../utils/format';
import type { Order, OrderItem, OrderStatus, Product, Sector } from '../types';

export default function OrdersPage() {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const { data: orders, loading } = useCollection<Order>('orders');
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [responseNotes, setResponseNotes] = useState('');
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
      showToast('Pedido enviado');
    } catch (err) {
      console.error(err);
      showToast('No se pudo enviar el pedido', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(order: Order, status: OrderStatus) {
    if (updatingStatus) return;

    // Si otro gestor ya cambio el estado (la coleccion es en tiempo real),
    // no repetir la accion: entregarlo dos veces descontaria stock doble.
    const current = orders.find((o) => o.id === order.id);
    if (!current || current.status !== order.status) {
      showToast('El pedido fue modificado por otro usuario. Revisa su estado actual.', 'error');
      setShowDetailModal(false);
      return;
    }

    setUpdatingStatus(true);
    try {
      // Al entregar, descontar stock registrando el movimiento de cada item
      // para que el historial quede consistente con el stock real.
      if (status === 'delivered') {
        const missing: string[] = [];
        for (const item of order.items) {
          try {
            await registerStockMovement({
              productId: item.productId,
              type: 'out',
              quantity: item.quantity,
              reason: `Pedido entregado a ${order.sectorName} (${order.userName})`,
              userId: appUser?.uid || '',
              userEmail: appUser?.email || '',
            });
          } catch (err) {
            // Un producto eliminado no debe bloquear la entrega del resto
            if (err instanceof Error && err.message === 'El producto ya no existe') {
              missing.push(item.productName);
              continue;
            }
            throw err;
          }
        }
        if (missing.length > 0) {
          showToast(`Sin descuento de stock (producto eliminado): ${missing.join(', ')}`, 'info');
        }
      }

      await updateDocument('orders', order.id, {
        status,
        responseNotes: responseNotes.trim(),
      });

      const statusMessages: Record<OrderStatus, string> = {
        pending: 'Pedido actualizado',
        approved: 'Pedido aprobado',
        rejected: 'Pedido rechazado',
        delivered: 'Pedido entregado y stock descontado',
      };
      showToast(statusMessages[status]);
      setShowDetailModal(false);
    } catch (err) {
      console.error(err);
      showToast(
        status === 'delivered'
          ? 'Error al descontar stock. Revisa los movimientos antes de reintentar.'
          : 'No se pudo actualizar el pedido',
        'error'
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  function openDetail(order: Order) {
    setSelectedOrder(order);
    setResponseNotes(order.responseNotes || '');
    setShowDetailModal(true);
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
                    <td style={{ fontSize: '0.8rem' }}>{formatDate(order.createdAt)}</td>
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
                      <button className="btn-icon" onClick={() => openDetail(order)}>
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
        <Modal title="Nuevo Pedido" onClose={() => setShowCreateModal(false)} maxWidth={640}>
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
        </Modal>
      )}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <Modal title="Detalle del Pedido" onClose={() => setShowDetailModal(false)} maxWidth={600}>
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
                  <p style={{ fontSize: '0.9rem' }}>{formatDateTime(selectedOrder.createdAt)}</p>
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
                    {isManager && selectedOrder.status !== 'delivered' && <th>Disponible</th>}
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    const insufficient = product ? product.stock < item.quantity : false;
                    return (
                      <tr key={item.productId}>
                        <td>{item.productName}</td>
                        <td>{item.quantity} {item.unit}</td>
                        {isManager && selectedOrder.status !== 'delivered' && (
                          <td>
                            {product ? (
                              <span className={`badge ${insufficient ? 'badge-red' : 'badge-green'}`}>
                                {product.stock} {product.unit}
                              </span>
                            ) : (
                              <span className="badge badge-gray">No existe</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
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

              {selectedOrder.responseNotes && !isManager && (
                <div style={{ marginBottom: 16 }}>
                  <div className="form-label">Respuesta</div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    {selectedOrder.responseNotes}
                  </p>
                </div>
              )}

              {isManager && selectedOrder.status !== 'delivered' && selectedOrder.status !== 'rejected' ? (
                <div className="form-group">
                  <label className="form-label">Respuesta / Observaciones</label>
                  <textarea
                    className="form-textarea"
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Comentario para el solicitante (opcional)"
                  />
                </div>
              ) : (
                isManager &&
                selectedOrder.responseNotes && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="form-label">Respuesta</div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                      {selectedOrder.responseNotes}
                    </p>
                  </div>
                )
              )}
            </div>

            {isManager && selectedOrder.status === 'pending' && (
              <div className="modal-footer">
                <button
                  className="btn btn-danger"
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedOrder, 'rejected')}
                >
                  <XCircle size={16} /> {updatingStatus ? 'Guardando...' : 'Rechazar'}
                </button>
                <button
                  className="btn btn-success"
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedOrder, 'approved')}
                >
                  <Check size={16} /> {updatingStatus ? 'Guardando...' : 'Aprobar'}
                </button>
              </div>
            )}

            {isManager && selectedOrder.status === 'approved' && (
              <div className="modal-footer">
                <button
                  className="btn btn-primary"
                  disabled={updatingStatus}
                  onClick={() => handleUpdateStatus(selectedOrder, 'delivered')}
                >
                  <Truck size={16} /> {updatingStatus ? 'Entregando...' : 'Marcar como Entregado'}
                </button>
              </div>
            )}
        </Modal>
      )}
    </div>
  );
}
