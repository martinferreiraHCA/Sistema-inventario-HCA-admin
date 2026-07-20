import type { Equipment, PublicEquipment } from '../types';
import { equipmentCategoryOf } from '../types';

/**
 * Extrae de un equipo SOLO los campos seguros de publicar.
 * Todo lo que no este aca (serie, IP, MAC, usuario asignado, notas,
 * sector) queda unicamente en la coleccion privada.
 */
export function publicEquipmentData(
  eq: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
): Omit<PublicEquipment, 'id' | 'updatedAt'> {
  return {
    code: eq.code,
    name: eq.name,
    category: equipmentCategoryOf(eq),
    type: eq.type,
    brand: eq.brand,
    model: eq.model,
    location: eq.location,
    status: eq.status,
  };
}
