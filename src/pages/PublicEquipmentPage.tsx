import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Laptop, LogIn } from 'lucide-react';
import { useCollection } from '../hooks/useFirestore';
import { useAuth } from '../contexts/AuthContext';
import PublicShell from '../components/PublicShell';
import EquipmentStatusBadge from '../components/EquipmentStatusBadge';
import { formatDateTime } from '../utils/format';
import type { PublicEquipment } from '../types';
import { EQUIPMENT_CATEGORY_LABELS } from '../types';

export default function PublicEquipmentPage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const { appUser } = useAuth();
  const { data: equipment, loading } = useCollection<PublicEquipment>('equipmentPublic');

  const eq = equipment.find((e) => e.id === equipmentId);
  const fullFichaPath = `/equipos/${equipmentId}`;
  const canSeeFull = !!appUser?.permissions.equipment;

  return (
    <PublicShell loginRedirect={fullFichaPath}>
      <Link
        to="/publico"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.85rem',
          color: 'var(--color-text-secondary)',
          textDecoration: 'none',
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={14} /> Todos los equipos
      </Link>

      {loading ? (
        <div className="card">
          <p style={{ color: 'var(--color-text-secondary)' }}>Cargando...</p>
        </div>
      ) : !eq ? (
        <div className="card">
          <div className="empty-state">
            <Laptop size={48} />
            <p>
              Equipo no encontrado. La etiqueta puede ser de un equipo dado de baja, o su ficha
              publica todavia no fue generada.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h1 style={{ fontSize: '1.35rem', margin: 0 }}>{eq.name}</h1>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                  Nº de inventario: <strong>{eq.code}</strong>
                </p>
              </div>
              <EquipmentStatusBadge status={eq.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px 16px' }}>
              {(
                [
                  ['Categoria', EQUIPMENT_CATEGORY_LABELS[eq.category] || ''],
                  ['Tipo', eq.type],
                  ['Marca', eq.brand],
                  ['Modelo', eq.model],
                  ['Ubicacion', eq.location],
                ] as [string, string][]
              )
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <div className="form-label" style={{ marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: '0.9rem' }}>{value}</div>
                  </div>
                ))}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-light)', marginTop: 16 }}>
              Ultima actualizacion: {formatDateTime(eq.updatedAt)}
            </p>
          </div>

          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
              El historial de reparaciones, los datos tecnicos y la gestion del equipo estan
              disponibles para el personal de la institucion.
            </p>
            {canSeeFull ? (
              <Link to={fullFichaPath} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                Ver ficha completa
              </Link>
            ) : (
              <Link
                to="/login"
                state={{ from: fullFichaPath }}
                className="btn btn-primary"
                style={{ textDecoration: 'none' }}
              >
                <LogIn size={16} /> Iniciar sesion para ver mas
              </Link>
            )}
          </div>
        </>
      )}
    </PublicShell>
  );
}
