import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Ruta a la que volver despues de iniciar sesion (ej. la ficha completa) */
  loginRedirect?: string;
}

// Marco de las paginas publicas: header institucional + boton de login.
// No requiere sesion iniciada.
export default function PublicShell({ children, loginRedirect }: Props) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-secondary)' }}>
      <header
        style={{
          background: 'var(--color-blue)',
          color: '#fff',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>HCA Inventario</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
            Consulta publica · Colegio y Liceo Hans Christian Andersen
          </div>
        </div>
        <Link
          to="/login"
          state={loginRedirect ? { from: loginRedirect } : undefined}
          className="btn btn-secondary"
          style={{ textDecoration: 'none' }}
        >
          <LogIn size={16} /> Iniciar sesion
        </Link>
      </header>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>{children}</main>
      <footer
        style={{
          textAlign: 'center',
          padding: '16px 0 28px',
          fontSize: '0.75rem',
          color: 'var(--color-text-light)',
        }}
      >
        Vista publica con informacion basica. Inicia sesion con tu cuenta @hca.edu.uy para ver el
        detalle completo y el historial.
      </footer>
    </div>
  );
}
