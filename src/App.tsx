import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './components/auth/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SectorsPage from './pages/SectorsPage';
import CategoriesPage from './pages/CategoriesPage';
import ProductsPage from './pages/ProductsPage';
import StockPage from './pages/StockPage';
import CostsPage from './pages/CostsPage';
import OrdersPage from './pages/OrdersPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import ReportsPage from './pages/ReportsPage';
import RelevamientoPage from './pages/RelevamientoPage';
import type { ModulePermissions } from './types';

function ProtectedRoute({
  children,
  permissionKey,
}: {
  children: React.ReactNode;
  permissionKey?: keyof ModulePermissions;
}) {
  const { appUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    );
  }

  if (!appUser) {
    return <Navigate to="/login" replace />;
  }

  if (permissionKey && !appUser.permissions[permissionKey]) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    );
  }

  if (appUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/sectors"
          element={
            <ProtectedRoute permissionKey="sectors">
              <SectorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute permissionKey="categories">
              <CategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute permissionKey="products">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ProtectedRoute permissionKey="stock">
              <StockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/relevamiento"
          element={
            <ProtectedRoute permissionKey="relevamiento">
              <RelevamientoPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/costs"
          element={
            <ProtectedRoute permissionKey="costs">
              <CostsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute permissionKey="orders">
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute permissionKey="users">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute permissionKey="roles">
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute permissionKey="reports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename="/Sistema-inventario-HCA-admin">
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
