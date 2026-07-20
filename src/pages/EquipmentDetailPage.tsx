import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Printer,
  Download,
  Link as LinkIcon,
  Wrench,
  Laptop,
  Plus,
} from 'lucide-react';
import { useCollection, addDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import EquipmentFormModal from '../components/EquipmentFormModal';
import EquipmentLabelsModal from '../components/EquipmentLabelsModal';
import EquipmentStatusBadge from '../components/EquipmentStatusBadge';
import { qrSvgMarkup, equipmentUrl, downloadQrPng } from '../utils/qr';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { Equipment, EquipmentLog, EquipmentLogType, Sector } from '../types';
import { EQUIPMENT_LOG_LABELS, EQUIPMENT_CATEGORY_LABELS, equipmentCategoryOf } from '../types';

const LOG_BADGES: Record<EquipmentLogType, string> = {
  reparacion: 'badge-red',
  mantenimiento: 'badge-blue',
  traslado: 'badge-orange',
  observacion: 'badge-gray',
  estado: 'badge-green',
};

export default function EquipmentDetailPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const { data: equipment, loading } = useCollection<Equipment>('equipment');
  const { data: logs } = useCollection<EquipmentLog>('equipmentLogs');
  const { data: sectors } = useCollection<Sector>('sectors');

  const [showEdit, setShowEdit] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logForm, setLogForm] = useState({
    type: 'observacion' as EquipmentLogType,
    description: '',
    cost: 0,
  });

  const isManager = appUser?.role === 'admin' || appUser?.role === 'gestor';
  const eq = equipment.find((e) => e.id === equipmentId);

  const eqLogs = useMemo(
    () =>
      logs
        .filter((l) => l.equipmentId === equipmentId)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [logs, equipmentId]
  );

  const repairCost = useMemo(
    () => eqLogs.reduce((sum, l) => sum + (Number(l.cost) || 0), 0),
    [eqLogs]
  );

  const showCostField = logForm.type === 'reparacion' || logForm.type === 'mantenimiento';

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    if (!eq || !logForm.description.trim()) return;
    const cost = showCostField ? Number(logForm.cost) : 0;
    if (!Number.isFinite(cost) || cost < 0) {
      showToast('El costo debe ser un numero mayor o igual a 0', 'error');
      return;
    }
    setSavingLog(true);
    try {
      await addDocument('equipmentLogs', {
        equipmentId: eq.id,
        equipmentCode: eq.code,
        type: logForm.type,
        description: logForm.description.trim(),
        cost,
        userId: appUser?.uid || '',
        userEmail: appUser?.email || '',
      });
      setLogForm({ type: 'observacion', description: '', cost: 0 });
      showToast('Registro agregado al historial');
    } catch (err) {
      console.error(err);
      showToast('No se pudo agregar el registro', 'error');
    } finally {
      setSavingLog(false);
    }
  }

  async function copyLink() {
    if (!eq) return;
    try {
      await navigator.clipboard.writeText(equipmentUrl(eq.id));
      showToast('Link copiado al portapapeles');
    } catch {
      showToast('No se pudo copiar el link', 'error');
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    );
  }

  if (!eq) {
    return (
      <div className="page-container">
        <div className="card">
          <div className="empty-state">
            <Laptop size={48} />
            <p>Equipo no encontrado. Puede haber sido eliminado.</p>
            <Link to="/equipos" className="btn btn-secondary" style={{ marginTop: 12 }}>
              <ArrowLeft size={16} /> Volver a Equipos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const infoRows: [string, string][] = [
    ['Categoria', EQUIPMENT_CATEGORY_LABELS[equipmentCategoryOf(eq)]],
    ['Tipo', eq.type],
    ['Marca', eq.brand],
    ['Modelo', eq.model],
    ['Nº de serie', eq.serial],
    ['IP', eq.ip],
    ['MAC', eq.mac],
    ['Usuario asignado', eq.assignedTo],
    ['Ubicacion', eq.location],
    ['Sector', sectors.find((s) => s.id === eq.sectorId)?.name || ''],
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link
            to="/equipos"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              marginBottom: 6,
            }}
          >
            <ArrowLeft size={14} /> Equipos
          </Link>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {eq.name}
            <EquipmentStatusBadge status={eq.status} />
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Nº de inventario: <strong>{eq.code}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowLabels(true)}>
            <Printer size={16} /> Etiqueta
          </button>
          {isManager && (
            <button className="btn btn-primary" onClick={() => setShowEdit(true)}>
              <Pencil size={16} /> Editar
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* Datos */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Datos del equipo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            {infoRows
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label}>
                  <div className="form-label" style={{ marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: '0.9rem' }}>{value}</div>
                </div>
              ))}
          </div>
          {eq.notes && (
            <div style={{ marginTop: 14 }}>
              <div className="form-label" style={{ marginBottom: 2 }}>Notas</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-line' }}>
                {eq.notes}
              </p>
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: 14 }}>
            Alta: {formatDateTime(eq.createdAt)} · Ultima modificacion: {formatDateTime(eq.updatedAt)}
          </p>
        </div>

        {/* QR */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Etiqueta QR</h3>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{ width: 150, height: 150, border: '1px solid var(--color-border)', borderRadius: 8, flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: qrSvgMarkup(equipmentUrl(eq.id), 'M') }}
            />
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                Al escanear este codigo con cualquier celular se abre esta ficha, con los datos del
                equipo y su historial de reparaciones.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    downloadQrPng(equipmentUrl(eq.id), `qr_${eq.code}.png`).catch(() =>
                      showToast('No se pudo descargar el QR', 'error')
                    )
                  }
                >
                  <Download size={14} /> Descargar PNG
                </button>
                <button className="btn btn-secondary btn-sm" onClick={copyLink}>
                  <LinkIcon size={14} /> Copiar link
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Wrench size={18} /> Historial ({eqLogs.length})
          </h3>
          {repairCost > 0 && (
            <span className="badge badge-blue">
              Costo acumulado: {formatCurrency(repairCost)}
            </span>
          )}
        </div>

        {/* Nuevo registro */}
        <form onSubmit={handleAddLog} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <select
              className="form-select"
              style={{ maxWidth: 180 }}
              value={logForm.type}
              onChange={(e) => setLogForm({ ...logForm, type: e.target.value as EquipmentLogType })}
            >
              {(Object.keys(EQUIPMENT_LOG_LABELS) as EquipmentLogType[])
                .filter((t) => t !== 'estado')
                .map((t) => (
                  <option key={t} value={t}>{EQUIPMENT_LOG_LABELS[t]}</option>
                ))}
            </select>
            <input
              className="form-input"
              style={{ flex: '1 1 260px' }}
              placeholder="Descripcion (ej. cambio de disco, no enciende, se traslado a...)"
              value={logForm.description}
              onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
              required
            />
            {showCostField && (
              <input
                className="form-input"
                style={{ width: 120 }}
                type="number"
                min="0"
                step="0.01"
                placeholder="Costo ($)"
                title="Costo (opcional)"
                value={logForm.cost || ''}
                onChange={(e) => setLogForm({ ...logForm, cost: Number(e.target.value) })}
              />
            )}
            <button type="submit" className="btn btn-primary" disabled={savingLog}>
              <Plus size={16} /> {savingLog ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>

        {eqLogs.length === 0 ? (
          <div className="empty-state">
            <Wrench size={40} />
            <p>Sin registros todavia</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {eqLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 0',
                  borderTop: '1px solid var(--color-border)',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <span className={`badge ${LOG_BADGES[log.type] || 'badge-gray'}`} style={{ flexShrink: 0 }}>
                  {EQUIPMENT_LOG_LABELS[log.type] || log.type}
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{log.description}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: 2 }}>
                    {formatDateTime(log.createdAt)} · {log.userEmail}
                  </p>
                </div>
                {log.cost > 0 && (
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flexShrink: 0 }}>
                    {formatCurrency(log.cost)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showEdit && (
        <EquipmentFormModal editing={eq} equipment={equipment} onClose={() => setShowEdit(false)} />
      )}
      {showLabels && (
        <EquipmentLabelsModal
          equipment={equipment}
          initialSelection={[eq.id]}
          onClose={() => setShowLabels(false)}
        />
      )}
    </div>
  );
}
