import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Laptop, ChevronRight } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import PublicShell from '../components/PublicShell';
import EquipmentStatusBadge from '../components/EquipmentStatusBadge';
import type { PublicEquipment, EquipmentCategory } from '../types';
import { EQUIPMENT_CATEGORY_LABELS } from '../types';

export default function PublicCatalogPage() {
  const { data: equipment, loading } = useCollection<PublicEquipment>('equipmentPublic');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const filtered = useMemo(() => {
    let result = [...equipment].sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
    if (filterCategory) result = result.filter((e) => e.category === filterCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e) =>
        [e.code, e.name, e.type, e.brand, e.model, e.location].some((v) =>
          (v || '').toLowerCase().includes(q)
        )
      );
    }
    return result;
  }, [equipment, filterCategory, searchQuery]);

  return (
    <PublicShell>
      <h1 style={{ fontSize: '1.3rem', marginBottom: 6 }}>Equipamiento de la institucion</h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
        Consulta publica del inventario. Toca un equipo para ver su ficha, o escanea la etiqueta QR
        pegada en el equipo.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 360 }}>
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
            placeholder="Buscar por codigo, nombre, ubicacion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="form-select"
          style={{ maxWidth: 220 }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">Todas las categorias</option>
          {(Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[]).map((c) => (
            <option key={c} value={c}>{EQUIPMENT_CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Laptop size={48} />
            <p>
              {equipment.length === 0
                ? 'Todavia no hay equipos publicados'
                : 'Sin resultados para la busqueda'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((eq, i) => (
              <Link
                key={eq.id}
                to={`/publico/${eq.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 4px',
                  borderTop: i > 0 ? '1px solid var(--color-border)' : undefined,
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {eq.name}
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', fontWeight: 400 }}>
                      {eq.code}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    {[EQUIPMENT_CATEGORY_LABELS[eq.category], eq.type, eq.location]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <EquipmentStatusBadge status={eq.status} />
                <ChevronRight size={16} color="var(--color-text-light)" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
