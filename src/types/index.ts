export type UserRole = 'admin' | 'gestor' | 'relevador' | 'usuario';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  relevador: 'Relevador',
  usuario: 'Usuario',
};

export interface ModulePermissions {
  dashboard: boolean;
  sectors: boolean;
  categories: boolean;
  products: boolean;
  stock: boolean;
  relevamiento: boolean;
  costs: boolean;
  orders: boolean;
  equipment: boolean;
  users: boolean;
  roles: boolean;
  reports: boolean;
}

export const DEFAULT_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  admin: {
    dashboard: true,
    sectors: true,
    categories: true,
    products: true,
    stock: true,
    relevamiento: true,
    costs: true,
    orders: true,
    equipment: true,
    users: true,
    roles: true,
    reports: true,
  },
  gestor: {
    dashboard: true,
    sectors: true,
    categories: true,
    products: true,
    stock: true,
    relevamiento: true,
    costs: true,
    orders: true,
    equipment: true,
    users: false,
    roles: false,
    reports: true,
  },
  relevador: {
    dashboard: true,
    sectors: false,
    categories: false,
    products: false,
    stock: false,
    relevamiento: true,
    costs: false,
    orders: false,
    equipment: true,
    users: false,
    roles: false,
    reports: false,
  },
  usuario: {
    dashboard: true,
    sectors: false,
    categories: false,
    products: false,
    stock: true,
    relevamiento: false,
    costs: false,
    orders: true,
    equipment: false,
    users: false,
    roles: false,
    reports: false,
  },
};

export interface AppUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  assignedSectors: string[];
  permissions: ModulePermissions;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sector {
  id: string;
  name: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  sectorId: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  sectorId: string;
  stock: number;
  minStock: number;
  unit: string;
  cost: number;
  active: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'delivered';

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
}

export interface Order {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  sectorId: string;
  sectorName: string;
  items: OrderItem[];
  status: OrderStatus;
  notes: string;
  responseNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleConfig {
  role: UserRole;
  label: string;
  permissions: ModulePermissions;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  sectorId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userId: string;
  userEmail: string;
  createdAt: string;
}

export type EquipmentStatus = 'operativo' | 'en_reparacion' | 'de_baja';

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  operativo: 'Operativo',
  en_reparacion: 'En reparacion',
  de_baja: 'De baja',
};

export type EquipmentCategory =
  | 'tecnologia'
  | 'audiovisual'
  | 'mobiliario'
  | 'laboratorio'
  | 'deportes'
  | 'herramientas'
  | 'otro';

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  tecnologia: 'Tecnologia',
  audiovisual: 'Audiovisual',
  mobiliario: 'Mobiliario',
  laboratorio: 'Laboratorio',
  deportes: 'Deportes',
  herramientas: 'Herramientas y mantenimiento',
  otro: 'Otro',
};

export interface Equipment {
  id: string;
  code: string; // numero de inventario, ej. HCA-PC-001
  name: string;
  category: EquipmentCategory;
  type: string;
  brand: string;
  model: string;
  serial: string;
  ip: string;
  mac: string;
  assignedTo: string;
  location: string;
  sectorId: string;
  status: EquipmentStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Los equipos creados antes de que existieran las categorias eran todos
// de informatica: ese es el fallback para documentos sin el campo.
export function equipmentCategoryOf(eq: { category?: EquipmentCategory }): EquipmentCategory {
  return eq.category && eq.category in EQUIPMENT_CATEGORY_LABELS ? eq.category : 'tecnologia';
}

/**
 * Version publica de un equipo: SOLO campos seguros de compartir.
 * Vive en la coleccion `equipmentPublic`, legible sin iniciar sesion.
 * Nunca incluye serie, IP, MAC, usuario asignado, notas ni historial.
 */
export interface PublicEquipment {
  id: string;
  code: string;
  name: string;
  category: EquipmentCategory;
  type: string;
  brand: string;
  model: string;
  location: string;
  status: EquipmentStatus;
  updatedAt: string;
}

export type EquipmentLogType = 'reparacion' | 'mantenimiento' | 'traslado' | 'observacion' | 'estado';

export const EQUIPMENT_LOG_LABELS: Record<EquipmentLogType, string> = {
  reparacion: 'Reparacion',
  mantenimiento: 'Mantenimiento',
  traslado: 'Traslado',
  observacion: 'Observacion',
  estado: 'Cambio de estado',
};

export interface EquipmentLog {
  id: string;
  equipmentId: string;
  equipmentCode: string;
  type: EquipmentLogType;
  description: string;
  cost: number;
  userId: string;
  userEmail: string;
  createdAt: string;
}
