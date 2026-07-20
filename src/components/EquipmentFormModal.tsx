import { useState } from 'react';
import { useCollection, addDocument, updateDocument } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Modal from './Modal';
import type { Equipment, EquipmentCategory, EquipmentStatus, Sector } from '../types';
import { EQUIPMENT_STATUS_LABELS, EQUIPMENT_CATEGORY_LABELS, equipmentCategoryOf } from '../types';

const TYPE_SUGGESTIONS: Record<EquipmentCategory, string[]> = {
  tecnologia: [
    'PC escritorio',
    'Notebook',
    'Tablet',
    'Impresora',
    'Monitor',
    'Router / Red',
    'Servidor',
    'Camara de seguridad',
  ],
  audiovisual: [
    'Proyector',
    'Pantalla / TV',
    'Parlante',
    'Microfono',
    'Consola de sonido',
    'Camara de fotos / video',
  ],
  mobiliario: ['Silla', 'Mesa', 'Escritorio', 'Pizarra', 'Armario', 'Estanteria', 'Banco'],
  laboratorio: [
    'Microscopio',
    'Balanza',
    'Material de vidrio',
    'Kit de ciencias',
    'Instrumento de medicion',
  ],
  deportes: ['Pelota', 'Colchoneta', 'Red', 'Arco / Tablero', 'Equipamiento de gimnasia'],
  herramientas: [
    'Herramienta electrica',
    'Herramienta manual',
    'Escalera',
    'Equipo de limpieza',
    'Electrodomestico',
  ],
  otro: [],
};

const CODE_PLACEHOLDERS: Record<EquipmentCategory, string> = {
  tecnologia: 'HCA-PC-001',
  audiovisual: 'HCA-AV-001',
  mobiliario: 'HCA-MOB-001',
  laboratorio: 'HCA-LAB-001',
  deportes: 'HCA-DEP-001',
  herramientas: 'HCA-HER-001',
  otro: 'HCA-EQ-001',
};

// Solo estos rubros tienen datos de red
const NETWORK_CATEGORIES: EquipmentCategory[] = ['tecnologia', 'audiovisual'];

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
    category: (editing ? equipmentCategoryOf(editing) : 'tecnologia') as EquipmentCategory,
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
  const showNetworkFields = NETWORK_CATEGORIES.includes(form.category);

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
        category: form.category,
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Categoria</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as EquipmentCategory })}
              >
                {(Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[]).map((c) => (
                  <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Nº de inventario</label>
              <input
                className="form-input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={CODE_PLACEHOLDERS[form.category]}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="PC Direccion, Pizarra Aula 3..."
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
                placeholder={TYPE_SUGGESTIONS[form.category][0] || 'Tipo de equipo'}
              />
              <datalist id="equipment-types">
                {TYPE_SUGGESTIONS[form.category].map((t) => (
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
            {showNetworkFields && (
              <>
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
              </>
            )}
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
