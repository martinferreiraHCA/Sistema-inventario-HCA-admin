import { useState, useMemo } from 'react';
import { DollarSign, Search } from 'lucide-react';
import { useCollection, updateDocument } from '../hooks/useFirestore';
import type { Product, Sector, Category } from '../types';

export default function CostsPage() {
  const { data: products } = useCollection<Product>('products');
  const { data: sectors } = useCollection<Sector>('sectors');
  const { data: categories } = useCollection<Category>('categories');
  const [filterSector, setFilterSector] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState(0);

  const activeSectors = sectors.filter((s) => s.active);

  const filteredProducts = useMemo(() => {
    let result = products.filter((p) => p.active);
    if (filterSector) result = result.filter((p) => p.sectorId === filterSector);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [products, filterSector, searchQuery]);

  const totalValue = useMemo(
    () => filteredProducts.reduce((sum, p) => sum + p.stock * p.cost, 0),
    [filteredProducts]
  );

  async function saveCost(productId: string) {
    await updateDocument('products', productId, { cost: editCost });
    setEditingId(null);
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Costos</h1>
        <div className="stat-card" style={{ padding: '12px 20px', margin: 0 }}>
          <DollarSign size={20} color="#0C5F55" />
          <div>
            <div className="stat-value" style={{ fontSize: '1.25rem' }}>
              ${totalValue.toLocaleString('es-UY', { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-label">Valor total del inventario filtrado</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: 350 }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-light)',
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar productos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: 200 }}
          value={filterSector}
          onChange={(e) => setFilterSector(e.target.value)}
        >
          <option value="">Todos los sectores</option>
          {activeSectors.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Sector</th>
                <th>Categoria</th>
                <th>Stock</th>
                <th>Costo Unitario</th>
                <th>Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td style={{ fontWeight: 600 }}>{product.name}</td>
                  <td>
                    <span className="badge badge-blue">
                      {sectors.find((s) => s.id === product.sectorId)?.name || '-'}
                    </span>
                  </td>
                  <td>{categories.find((c) => c.id === product.categoryId)?.name || '-'}</td>
                  <td>{product.stock} {product.unit}</td>
                  <td>
                    {editingId === product.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editCost}
                          onChange={(e) => setEditCost(Number(e.target.value))}
                          style={{ width: 100, padding: '4px 8px' }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveCost(product.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => saveCost(product.id)}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', borderBottom: '1px dashed var(--color-text-light)' }}
                        onClick={() => {
                          setEditingId(product.id);
                          setEditCost(product.cost);
                        }}
                        title="Click para editar"
                      >
                        ${product.cost.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    ${(product.stock * product.cost).toLocaleString('es-UY', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
