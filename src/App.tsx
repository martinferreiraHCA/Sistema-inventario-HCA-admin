import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
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
import EquipmentPage from './pages/EquipmentPage';
import EquipmentDetailPage from './pages/EquipmentDetailPage';
import PublicCatalogPage from './pages/PublicCatalogPage';
import PublicEquipmentPage from './pages/PublicEquipmentPage';
import { APP_BASENAME } from './config/app';
import type { ModulePermissions } from './types';

function ProtectedRoute({
  children,
  permissionKey,
}: {
  children: React.ReactNode;
  permissionKey?: keyof ModulePermissions;
}) {
  const { appUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    );
  }

  if (!appUser) {
    // La ficha de un equipo tiene version publica: quien escanea el QR sin
    // sesion ve esa version en lugar de chocar con el login
    const equipmentMatch = location.pathname.match(/^\/equipos\/([^/]+)$/);
    if (equipmentMatch) {
      return <Navigate to={`/publico/${equipmentMatch[1]}`} replace />;
    }
    // Guardar el destino: despues del login se vuelve a la pagina pedida
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (permissionKey && !appUser.permissions[permissionKey]) {
    // Sin permiso del modulo de equipos tambien se puede ver la ficha publica
    const equipmentMatch = location.pathname.match(/^\/equipos\/([^/]+)$/);
    if (equipmentMatch) {
      return <Navigate to={`/publico/${equipmentMatch[1]}`} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { appUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
      </div>
    );
  }

  if (appUser) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from || '/dashboard'} replace />;
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
      {/* Vista publica: accesible sin iniciar sesion */}
      <Route path="/publico" element={<PublicCatalogPage />} />
      <Route path="/publico/:equipmentId" element={<PublicEquipmentPage />} />
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
          path="/equipos"
          element={
            <ProtectedRoute permissionKey="equipment">
              <EquipmentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/equipos/:equipmentId"
          element={
            <ProtectedRoute permissionKey="equipment">
              <EquipmentDetailPage />
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
    <BrowserRouter basename={APP_BASENAME}>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
