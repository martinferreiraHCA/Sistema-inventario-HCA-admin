import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Package,
  Building2,
  AlertTriangle,
  ClipboardList,
} from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import type { Product, Sector, Order, Category } from '../types';

const CHART_COLORS = ['#242B59', '#BF1818', '#0C5F55', '#ED8B0D', '#E1523D', '#A4B01D', '#252525'];

export default function DashboardPage() {
  const { appUser } = useAuth();
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const { data: orders } = useCollection<Order>('orders');

  const filteredProducts = useMemo(() => {
    if (appUser?.role === 'admin' || appUser?.role === 'gestor') return products;
    return products.filter((p) => appUser?.assignedSectors.includes(p.sectorId));
  }, [products, appUser]);

  const lowStockProducts = useMemo(
    () => filteredProducts.filter((p) => p.stock <= p.minStock && p.active),
    [filteredProducts]
  );

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders]
  );

  const stockBySector = useMemo(() => {
    const map: Record<string, { name: string; total: number; value: number }> = {};
    filteredProducts.forEach((p) => {
      if (!p.active) return;
      const sector = sectors.find((s) => s.id === p.sectorId);
      const name = sector?.name || 'Sin sector';
      if (!map[p.sectorId]) {
        map[p.sectorId] = { name, total: 0, value: 0 };
      }
      map[p.sectorId].total += p.stock;
      map[p.sectorId].value += p.stock * p.cost;
    });
    return Object.values(map);
  }, [filteredProducts, sectors]);

  const stockByCategory = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    filteredProducts.forEach((p) => {
      if (!p.active) return;
      const cat = categories.find((c) => c.id === p.categoryId);
      const name = cat?.name || 'Sin categoria';
      if (!map[p.categoryId]) {
        map[p.categoryId] = { name, count: 0 };
      }
      map[p.categoryId].count += p.stock;
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [filteredProducts, categories]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(36, 43, 89, 0.1)' }}>
            <Package size={24} color="#242B59" />
          </div>
          <div>
            <div className="stat-value">{filteredProducts.filter((p) => p.active).length}</div>
            <div className="stat-label">Productos activos</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(12, 95, 85, 0.1)' }}>
            <Building2 size={24} color="#0C5F55" />
          </div>
          <div>
            <div className="stat-value">{sectors.filter((s) => s.active).length}</div>
            <div className="stat-label">Sectores</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(237, 139, 13, 0.1)' }}>
            <AlertTriangle size={24} color="#ED8B0D" />
          </div>
          <div>
            <div className="stat-value">{lowStockProducts.length}</div>
            <div className="stat-label">Stock bajo</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(191, 24, 24, 0.1)' }}>
            <ClipboardList size={24} color="#BF1818" />
          </div>
          <div>
            <div className="stat-value">{pendingOrders.length}</div>
            <div className="stat-label">Pedidos pendientes</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Stock by Sector */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Stock por Sector</h3>
          {stockBySector.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stockBySector}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EA" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E2E4EA',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Bar dataKey="total" fill="#242B59" radius={[6, 6, 0, 0]} name="Unidades" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>No hay datos de stock disponibles</p>
            </div>
          )}
        </div>

        {/* Distribution by Category */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Distribucion por Categoria</h3>
          {stockByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockByCategory}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) =>
                    `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={true}
                >
                  {stockByCategory.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <p>No hay datos de categorias disponibles</p>
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 20, color: '#ED8B0D' }}>
            <AlertTriangle size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Productos con Stock Bajo
          </h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Sector</th>
                  <th>Stock Actual</th>
                  <th>Stock Minimo</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{sectors.find((s) => s.id === p.sectorId)?.name || '-'}</td>
                    <td>
                      <span className="badge badge-red">
                        {p.stock} {p.unit}
                      </span>
                    </td>
                    <td>
                      {p.minStock} {p.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
