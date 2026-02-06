import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  X,
  DollarSign,
  ShieldCheck,
  FileBarChart,
  ClipboardCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { ModulePermissions } from '../../types';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  permissionKey?: keyof ModulePermissions;
  children?: { label: string; path: string; permissionKey?: keyof ModulePermissions }[];
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard size={20} />,
    path: '/dashboard',
    permissionKey: 'dashboard',
  },
  {
    label: 'Inventario',
    icon: <Package size={20} />,
    children: [
      { label: 'Sectores', path: '/sectors', permissionKey: 'sectors' },
      { label: 'Categorias', path: '/categories', permissionKey: 'categories' },
      { label: 'Productos', path: '/products', permissionKey: 'products' },
      { label: 'Movimientos de Stock', path: '/stock', permissionKey: 'stock' },
    ],
  },
  {
    label: 'Relevamiento',
    icon: <ClipboardCheck size={20} />,
    path: '/relevamiento',
    permissionKey: 'relevamiento',
  },
  {
    label: 'Costos',
    icon: <DollarSign size={20} />,
    path: '/costs',
    permissionKey: 'costs',
  },
  {
    label: 'Pedidos',
    icon: <ClipboardList size={20} />,
    path: '/orders',
    permissionKey: 'orders',
  },
  {
    label: 'Reportes',
    icon: <FileBarChart size={20} />,
    path: '/reports',
    permissionKey: 'reports',
  },
  {
    label: 'Administracion',
    icon: <ShieldCheck size={20} />,
    children: [
      { label: 'Usuarios', path: '/users', permissionKey: 'users' },
      { label: 'Configurar Roles', path: '/roles', permissionKey: 'roles' },
    ],
  },
];

export default function Sidebar() {
  const { appUser, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Inventario']);
  const [mobileOpen, setMobileOpen] = useState(false);

  const permissions = appUser?.permissions;

  function toggleMenu(label: string) {
    setExpandedMenus((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }

  function hasAnyChildPermission(item: MenuItem): boolean {
    if (!permissions) return false;
    if (item.children) {
      return item.children.some(
        (child) => !child.permissionKey || permissions[child.permissionKey]
      );
    }
    return !item.permissionKey || permissions[item.permissionKey];
  }

  function renderMenuItem(item: MenuItem) {
    if (!hasAnyChildPermission(item)) return null;

    if (item.children) {
      const isExpanded = expandedMenus.includes(item.label);
      const isActive = item.children.some((c) => location.pathname === c.path);

      return (
        <div key={item.label} className="sidebar-menu-group">
          <button
            className={`sidebar-menu-item sidebar-menu-group-toggle ${isActive ? 'active' : ''}`}
            onClick={() => toggleMenu(item.label)}
          >
            <span className="sidebar-menu-icon">{item.icon}</span>
            {!collapsed && (
              <>
                <span className="sidebar-menu-label">{item.label}</span>
                <span className="sidebar-menu-arrow">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </>
            )}
          </button>
          {isExpanded && !collapsed && (
            <div className="sidebar-submenu">
              {item.children.map((child) => {
                if (child.permissionKey && permissions && !permissions[child.permissionKey]) {
                  return null;
                }
                return (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={({ isActive }) =>
                      `sidebar-submenu-item ${isActive ? 'active' : ''}`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    {child.label}
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path!}
        className={({ isActive }) => `sidebar-menu-item ${isActive ? 'active' : ''}`}
        onClick={() => setMobileOpen(false)}
      >
        <span className="sidebar-menu-icon">{item.icon}</span>
        {!collapsed && <span className="sidebar-menu-label">{item.label}</span>}
      </NavLink>
    );
  }

  return (
    <>
      {/* Mobile toggle */}
      <button className="sidebar-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Header */}
        <div className="sidebar-header">
          {!collapsed && (
            <div className="sidebar-brand">
              <h3 style={{ fontSize: '1rem', margin: 0 }}>HCA Inventario</h3>
            </div>
          )}
          <button className="btn-icon sidebar-collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            <Menu size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">{menuItems.map(renderMenuItem)}</nav>

        {/* User Section */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div
              className="sidebar-user-avatar"
              style={{ background: 'var(--color-blue)', color: 'white' }}
            >
              {appUser?.displayName?.charAt(0).toUpperCase() || '?'}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{appUser?.displayName}</span>
                <span className="sidebar-user-role">
                  {appUser?.role === 'admin'
                    ? 'Administrador'
                    : appUser?.role === 'gestor'
                    ? 'Gestor'
                    : appUser?.role === 'relevador'
                    ? 'Relevador'
                    : 'Usuario'}
                </span>
              </div>
            )}
          </div>
          <button className="btn-icon" onClick={logout} title="Cerrar sesion">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
