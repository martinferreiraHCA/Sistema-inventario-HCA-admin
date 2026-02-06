export type UserRole = 'admin' | 'gestor' | 'relevador' | 'usuario';

export interface ModulePermissions {
  dashboard: boolean;
  sectors: boolean;
  categories: boolean;
  products: boolean;
  stock: boolean;
  relevamiento: boolean;
  costs: boolean;
  orders: boolean;
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
