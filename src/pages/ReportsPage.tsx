import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Download } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import type { Product, Sector, Category, StockMovement, Order } from '../types';

const COLORS = ['#242B59', '#BF1818', '#0C5F55', '#ED8B0D', '#E1523D', '#A4B01D', '#252525'];

export default function ReportsPage() {
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const { data: movements } = useCollection<StockMovement>('stockMovements');
  const { data: orders } = useCollection<Order>('orders');
  const [selectedSector, setSelectedSector] = useState('');

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.active);
    if (selectedSector) result = result.filter((p) => p.sectorId === selectedSector);
    return result;
  }, [products, selectedSector]);

  // Value by sector
  const valueBySector = useMemo(() => {
    const map: Record<string, number> = {};
    products.filter((p) => p.active).forEach((p) => {
      const name = sectors.find((s) => s.id === p.sectorId)?.name || 'Otro';
      map[name] = (map[name] || 0) + p.stock * p.cost;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
  }, [products, sectors]);

  // Movement trends (last 30 days), agrupados por fecha local (no UTC)
  const movementTrend = useMemo(() => {
    const localKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const now = new Date();
    const days: Record<string, { date: string; entradas: number; salidas: number }> = {};

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days[localKey(d)] = { date: `${d.getDate()}/${d.getMonth() + 1}`, entradas: 0, salidas: 0 };
    }

    movements.forEach((m) => {
      const key = localKey(new Date(m.createdAt));
      if (days[key]) {
        if (m.type === 'in') days[key].entradas += m.quantity;
        else if (m.type === 'out') days[key].salidas += m.quantity;
      }
    });

    return Object.values(days);
  }, [movements]);

  // Orders by status
  const ordersByStatus = useMemo(() => {
    const counts = { pending: 0, approved: 0, rejected: 0, delivered: 0 };
    orders.forEach((o) => {
      if (counts[o.status as keyof typeof counts] !== undefined) {
        counts[o.status as keyof typeof counts]++;
      }
    });
    return [
      { name: 'Pendientes', value: counts.pending },
      { name: 'Aprobados', value: counts.approved },
      { name: 'Rechazados', value: counts.rejected },
      { name: 'Entregados', value: counts.delivered },
    ].filter((d) => d.value > 0);
  }, [orders]);

  // Top products by stock value
  const topProducts = useMemo(() => {
    return [...filteredProducts]
      .sort((a, b) => b.stock * b.cost - a.stock * a.cost)
      .slice(0, 10)
      .map((p) => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
        value: Math.round(p.stock * p.cost * 100) / 100,
      }));
  }, [filteredProducts]);

  function csvCell(value: string | number): string {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function exportCSV() {
    const headers = ['Producto', 'Sector', 'Categoria', 'Stock', 'Stock Minimo', 'Unidad', 'Costo', 'Valor Total'];
    const rows = filteredProducts.map((p) => [
      p.name,
      sectors.find((s) => s.id === p.sectorId)?.name || '',
      categories.find((c) => c.id === p.categoryId)?.name || '',
      p.stock,
      p.minStock,
      p.unit,
      p.cost,
      (p.stock * p.cost).toFixed(2),
    ]);

    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    // BOM para que Excel abra el archivo con acentos correctos
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Reportes</h1>
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            className="form-select"
            style={{ width: 200 }}
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
          >
            <option value="">Todos los sectores</option>
            {sectors.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
        {/* Value by Sector */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Valor por Sector ($)</h3>
          {valueBySector.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={valueBySector}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EA" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" fill="#242B59" radius={[6, 6, 0, 0]} name="Valor ($)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sin datos</p></div>
          )}
        </div>

        {/* Movement Trend */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Movimientos (ultimos 30 dias)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={movementTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EA" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="entradas" stroke="#0C5F55" strokeWidth={2} name="Entradas" dot={false} />
              <Line type="monotone" dataKey="salidas" stroke="#BF1818" strokeWidth={2} name="Salidas" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders by Status */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Pedidos por Estado</h3>
          {ordersByStatus.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={ordersByStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {ordersByStatus.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sin pedidos</p></div>
          )}
        </div>

        {/* Top Products */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Top 10 Productos por Valor</h3>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E4EA" />
                <XAxis type="number" fontSize={12} />
                <YAxis type="category" dataKey="name" fontSize={11} width={130} />
                <Tooltip formatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" fill="#BF1818" radius={[0, 6, 6, 0]} name="Valor ($)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sin datos</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
