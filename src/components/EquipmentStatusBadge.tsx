import type { EquipmentStatus } from '../types';
import { EQUIPMENT_STATUS_LABELS } from '../types';

export default function EquipmentStatusBadge({ status }: { status: EquipmentStatus }) {
  const cls =
    status === 'operativo' ? 'badge-green' : status === 'en_reparacion' ? 'badge-orange' : 'badge-gray';
  return <span className={`badge ${cls}`}>{EQUIPMENT_STATUS_LABELS[status] || status}</span>;
}
