import { useState } from 'react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from './Modal';
import type { Equipment, EquipmentStatus, Sector } from '../types';
import { EQUIPMENT_STATUS_LABELS } from '../types';

const TYPE_SUGGESTIONS = [
  'PC escritorio',
  'Notebook',
  'Tablet',
  'Impresora',
  'Proyector',
  'Monitor',
  'Camara',
  'Router / Red',
  'Audio',
  'Otro',
];

interface Props {
  editing: Equipment | null;
  equipment: Equipment[];
  onClose: () => void;
}

export default function EquipmentFormModal({ editing, equipment, onClose }: Props) {
  const { appUser } = useAuth();
  const { showToast } = useToast();
  const { data: sectors } = useCollection<Sector>('sectors');
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: editing?.code || '',
    name: editing?.name || '',
    type: editing?.type || '',
    brand: editing?.brand || '',
    model: editing?.model || '',
    serial: editing?.serial || '',
    ip: editing?.ip || '',
    mac: editing?.mac || '',
    assignedTo: editing?.assignedTo || '',
    location: editing?.location || '',
    sectorId: editing?.sectorId || '',
    status: (editing?.status || 'operativo') as EquipmentStatus,
    notes: editing?.notes || '',
  });

  const activeSectors = sectors.filter((s) => s.active);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim();
    const name = form.name.trim();
    if (!code || !name) return;

    const codeChanged = !editing || editing.code.trim().toLowerCase() !== code.toLowerCase();
    const duplicate =
      codeChanged &&
      equipment.some((q) => q.id !== editing?.id && q.code.trim().toLowerCase() === code.toLowerCase());
    if (duplicate) {
      showToast(`Ya existe un equipo con el numero de inventario "${code}"`, 'error');
      return;
    }

    setSaving(true);
    try {
      const data = {
        code,
        name,
        type: form.type.trim(),
        brand: form.brand.trim(),
        model: form.model.trim(),
        serial: form.serial.trim(),
        ip: form.ip.trim(),
        mac: form.mac.trim(),
        assignedTo: form.assignedTo.trim(),
        location: form.location.trim(),
        sectorId: form.sectorId,
        status: form.status,
        notes: form.notes.trim(),
      };

      if (editing) {
        await updateDocument('equipment', editing.id, data);
        // Un cambio de estado queda registrado en el historial del equipo
        if (form.status !== editing.status) {
          await addDocument('equipmentLogs', {
            equipmentId: editing.id,
            equipmentCode: code,
            type: 'estado',
            description: `Estado: ${EQUIPMENT_STATUS_LABELS[editing.status] || editing.status} → ${EQUIPMENT_STATUS_LABELS[form.status]}`,
            cost: 0,
            userId: appUser?.uid || '',
            userEmail: appUser?.email || '',
          });
        }
        showToast('Equipo actualizado');
      } else {
        const id = await addDocument('equipment', data);
        await addDocument('equipmentLogs', {
          equipmentId: id,
          equipmentCode: code,
          type: 'observacion',
          description: 'Equipo dado de alta en el sistema',
          cost: 0,
          userId: appUser?.uid || '',
          userEmail: appUser?.email || '',
        });
        showToast('Equipo creado');
      }
      onClose();
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar el equipo', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? 'Editar Equipo' : 'Nuevo Equipo'} onClose={onClose} maxWidth={680}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Nº de inventario</label>
              <input
                className="form-input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="HCA-PC-001"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="PC Direccion"
                required
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <input
                className="form-input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                list="equipment-types"
                placeholder="Notebook"
              />
              <datalist id="equipment-types">
                {TYPE_SUGGESTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Marca</label>
              <input
                className="form-input"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Modelo</label>
              <input
                className="form-input"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Nº de serie</label>
              <input
                className="form-input"
                value={form.serial}
                onChange={(e) => setForm({ ...form, serial: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">IP</label>
              <input
                className="form-input"
                value={form.ip}
                onChange={(e) => setForm({ ...form, ip: e.target.value })}
                placeholder="192.168.1.10"
              />
            </div>
            <div className="form-group">
              <label className="form-label">MAC</label>
              <input
                className="form-input"
                value={form.mac}
                onChange={(e) => setForm({ ...form, mac: e.target.value })}
                placeholder="A0:B1:C2:D3:E4:05"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Usuario asignado</label>
              <input
                className="form-input"
                value={form.assignedTo}
                onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                placeholder="Direccion, Alumnos..."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ubicacion</label>
              <input
                className="form-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Sala de Informatica"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Sector</label>
              <select
                className="form-select"
                value={form.sectorId}
                onChange={(e) => setForm({ ...form, sectorId: e.target.value })}
              >
                <option value="">Sin sector</option>
                {activeSectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select
              className="form-select"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as EquipmentStatus })}
            >
              {(Object.keys(EQUIPMENT_STATUS_LABELS) as EquipmentStatus[]).map((s) => (
                <option key={s} value={s}>{EQUIPMENT_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notas</label>
            <textarea
              className="form-textarea"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Observaciones del equipo"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
