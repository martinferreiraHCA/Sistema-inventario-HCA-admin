import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, QrCode, Printer, Eye, Laptop } from 'lucide-react';
import { useCollection, deleteDocument, setDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { publicEquipmentData } from '../utils/equipmentPublic';
import EquipmentFormModal from '../components/EquipmentFormModal';
import EquipmentLabelsModal from '../components/EquipmentLabelsModal';
import EquipmentStatusBadge from '../components/EquipmentStatusBadge';
import type { Equipment, EquipmentCategory, EquipmentStatus, PublicEquipment } from '../types';
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_CATEGORY_LABELS, equipmentCategoryOf } from '../types';

export default function EquipmentPage() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { data: equipment, loading } = useCollection<Equipment>('equipment');
  const { data: publicEquipment, loading: loadingPublic } = useCollection<PublicEquipment>('equipmentPublic');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [labelSelection, setLabelSelection] = useState<string[] | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const isManager = appUser?.role === 'admin' || appUser?.role === 'gestor';
  const isAdmin = appUser?.role === 'admin';

  // Backfill silencioso del espejo publico: genera/actualiza las fichas
  // publicas de equipos creados antes de que existiera la vista publica,
  // y elimina espejos huerfanos. Corre una sola vez por visita de un gestor.
  const syncedPublic = useRef(false);
  useEffect(() => {
    if (syncedPublic.current || loading || loadingPublic || !isManager) return;
    syncedPublic.current = true;
    (async () => {
      try {
        const publicById = new Map(publicEquipment.map((p) => [p.id, p]));
        for (const eq of equipment) {
          const pub = publicEquipmentData(eq);
          const current = publicById.get(eq.id);
          const outdated =
            !current ||
            (Object.keys(pub) as (keyof typeof pub)[]).some((k) => current[k] !== pub[k]);
          if (outdated) await setDocument('equipmentPublic', eq.id, pub);
        }
        for (const pub of publicEquipment) {
          if (!equipment.some((eq) => eq.id === pub.id)) {
            await deleteDocument('equipmentPublic', pub.id);
          }
        }
      } catch (err) {
        console.error('Error sincronizando fichas publicas:', err);
      }
    })();
  }, [loading, loadingPublic, isManager, equipment, publicEquipment]);

  const types = useMemo(() => {
    const source = filterCategory
      ? equipment.filter((e) => equipmentCategoryOf(e) === filterCategory)
      : equipment;
    return [...new Set(source.map((e) => e.type).filter(Boolean))].sort();
  }, [equipment, filterCategory]);

  const filtered = useMemo(() => {
    let result = [...equipment].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    if (filterCategory) result = result.filter((e) => equipmentCategoryOf(e) === filterCategory);
    if (filterType) result = result.filter((e) => e.type === filterType);
    if (filterStatus) result = result.filter((e) => e.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        [e.code, e.name, e.serial, e.ip, e.mac, e.assignedTo, e.location, e.brand, e.model]
          .some((v) => (v || '').toLowerCase().includes(q))
      );
    }
    return result;
  }, [equipment, filterCategory, filterType, filterStatus, searchQuery]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(eq: Equipment) {
    setEditing(eq);
    setShowForm(true);
  }

  function openLabels(selection?: string[]) {
    setLabelSelection(selection);
    setShowLabels(true);
  }

  async function handleDelete(eq: Equipment) {
    const ok = await confirm({
      title: 'Eliminar equipo',
      message: `Se eliminara "${eq.name}" (${eq.code}) de forma permanente. Las etiquetas QR ya impresas dejaran de funcionar.\n\nSi el equipo salio de servicio, marca su estado como "De baja" en lugar de eliminarlo.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteDocument('equipment', eq.id);
      await deleteDocument('equipmentPublic', eq.id).catch(() => {
        // El espejo puede no existir todavia; el backfill limpia huerfanos
      });
      showToast('Equipo eliminado');
    } catch (err) {
      console.error(err);
      showToast('No se pudo eliminar el equipo', 'error');
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Equipos</h1>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => openLabels(filtered.map((e) => e.id))}
            disabled={filtered.length === 0}
          >
            <Printer size={18} /> Etiquetas QR
          </button>
          {isManager && (
            <button className="btn btn-primary" onClick={openCreate}>
              <Plus size={18} /> Nuevo Equipo
            </button>
          )}
        </div>
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
            placeholder="Buscar por codigo, nombre, serie, IP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterCategory}
          onChange={(e) => {
            setFilterCategory(e.target.value);
            setFilterType('');
          }}
        >
          <option value="">Todas las categorias</option>
          {(Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[]).map((c) => (
            <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {types.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ maxWidth: 180 }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {(Object.keys(EQUIPMENT_STATUS_LABELS) as EquipmentStatus[]).map((s) => (
            <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Laptop size={48} />
            <p>{equipment.length === 0 ? 'No hay equipos registrados' : 'Sin resultados para los filtros'}</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nombre</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Marca / Modelo</th>
                  <th>Ubicacion</th>
                  <th>Estado</th>
                  <th style={{ width: 150 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((eq) => (
                  <tr key={eq.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <QrCode size={14} color="var(--color-text-light)" />
                        {eq.code}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{eq.name}</div>
                      {eq.assignedTo && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                          {eq.assignedTo}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-blue">
                        {EQUIPMENT_CATEGORY_LABELS[equipmentCategoryOf(eq)]}
                      </span>
                    </td>
                    <td>{eq.type || '-'}</td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {[eq.brand, eq.model].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td>{eq.location || '-'}</td>
                    <td><EquipmentStatusBadge status={eq.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn-icon"
                          title="Ver ficha e historial"
                          onClick={() => navigate(`/equipos/${eq.id}`)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          title="Imprimir etiqueta"
                          onClick={() => openLabels([eq.id])}
                        >
                          <Printer size={16} />
                        </button>
                        {isManager && (
                          <button className="btn-icon" title="Editar" onClick={() => openEdit(eq)}>
                            <Pencil size={16} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="btn-icon"
                            title="Eliminar"
                            onClick={() => handleDelete(eq)}
                            style={{ color: 'var(--color-red)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <EquipmentFormModal
          editing={editing}
          equipment={equipment}
          onClose={() => setShowForm(false)}
        />
      )}

      {showLabels && (
        <EquipmentLabelsModal
          equipment={equipment}
          initialSelection={labelSelection}
          onClose={() => setShowLabels(false)}
        />
      )}
    </div>
  );
}
