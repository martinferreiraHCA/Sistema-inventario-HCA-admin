import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  maxWidth?: number;
  children: ReactNode;
}

// Se cierra solo con la X o los botones del pie: un click fuera del modal
// no descarta un formulario a medio completar.
export default function Modal({ title, onClose, maxWidth, children }: ModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Cerrar">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
