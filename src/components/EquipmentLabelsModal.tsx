import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import Modal from './Modal';
import { qrSvgMarkup, equipmentUrl, qrModuleCount, type QrEcl } from '../utils/qr';
import type { Equipment } from '../types';

type LabelDesign = 'estandar' | 'grande';

interface Preset {
  id: string;
  n: string;
  w: number;
  h: number;
  cols: number;
  rows: number;
  mt: number;
  ml: number;
  gx: number;
  gy: number;
}

// Formatos de plancha A4 autoadhesiva (medidas en mm)
const PRESETS: Preset[] = [
  { id: '24', n: '24 por hoja — 70 × 37 mm (3×8)', w: 70, h: 37, cols: 3, rows: 8, mt: 0.5, ml: 0, gx: 0, gy: 0 },
  { id: '21', n: '21 por hoja — 70 × 42,4 mm (3×7)', w: 70, h: 42.4, cols: 3, rows: 7, mt: 0.1, ml: 0, gx: 0, gy: 0 },
  { id: '16', n: '16 por hoja — 105 × 37 mm (2×8)', w: 105, h: 37, cols: 2, rows: 8, mt: 0.5, ml: 0, gx: 0, gy: 0 },
  { id: '14', n: '14 por hoja — 105 × 42,4 mm (2×7)', w: 105, h: 42.4, cols: 2, rows: 7, mt: 0.1, ml: 0, gx: 0, gy: 0 },
  { id: '10', n: '10 por hoja — 105 × 59,4 mm (2×5)', w: 105, h: 59.4, cols: 2, rows: 5, mt: 0, ml: 0, gx: 0, gy: 0 },
  { id: '8', n: '8 por hoja — 105 × 74 mm (2×4)', w: 105, h: 74, cols: 2, rows: 4, mt: 0.5, ml: 0, gx: 0, gy: 0 },
  { id: '40', n: '40 por hoja — 52,5 × 29,7 mm (4×10)', w: 52.5, h: 29.7, cols: 4, rows: 10, mt: 0, ml: 0, gx: 0, gy: 0 },
  { id: '65', n: '65 por hoja — 38,1 × 21,2 mm (5×13)', w: 38.1, h: 21.2, cols: 5, rows: 13, mt: 10.7, ml: 4.65, gx: 2.55, gy: 0 },
];

// Formatos grandes (para access points y equipos de red)
const LARGE_PRESETS: Preset[] = [
  { id: 'g4', n: '4 por hoja — 92 × 131 mm (2×2)', w: 92, h: 131, cols: 2, rows: 2, mt: 13.5, ml: 10, gx: 6, gy: 8 },
  { id: 'g2', n: '2 por hoja — 190 × 131 mm', w: 190, h: 131, cols: 1, rows: 2, mt: 13.5, ml: 10, gx: 0, gy: 8 },
  { id: 'g1', n: '1 por hoja — 190 × 270 mm (A4 completa)', w: 190, h: 270, cols: 1, rows: 1, mt: 13.5, ml: 10, gx: 0, gy: 0 },
  { id: 'g8', n: '8 por hoja — 105 × 74 mm (2×4)', w: 105, h: 74, cols: 2, rows: 4, mt: 0.5, ml: 0, gx: 0, gy: 0 },
];

const DEFAULT_TITLE = 'COLEGIO Y LICEO HANS CHRISTIAN ANDERSEN';
const MM_TO_PX = 96 / 25.4;

/* ============ Etiqueta estandar (chica) ============ */

interface LabelStyle {
  w: number;
  h: number;
  pad: number;
  titleSize: number;
  nameSize: number;
  fieldSize: number;
  qrSide: number;
  ecl: QrEcl;
  showTitle: boolean;
  showSerial: boolean;
  border: boolean;
  title: string;
}

function labelStyle(w: number, h: number, border: boolean, title: string): LabelStyle {
  // Escala proporcional respecto de la etiqueta base de 70 × 37 mm
  const k = Math.min(w / 70, h / 37);
  const showTitle = h >= 24 && title.trim() !== '';
  const titleSize = Math.max(3.5, Math.min(7, 5.5 * k));
  const titleMm = showTitle ? titleSize * 0.353 * 1.35 : 0;
  const pad = Math.max(1, 1.8 * k);
  const qrSide = Math.round(Math.min(h - 2 * pad - titleMm - 0.6, w * 0.45) * 10) / 10;
  return {
    w,
    h,
    pad,
    titleSize,
    nameSize: Math.max(4.5, Math.min(11, 8 * k)),
    fieldSize: Math.max(3.5, Math.min(8, 5.6 * k)),
    qrSide,
    // En etiquetas chicas menos correccion = menos modulos = puntos mas grandes
    ecl: qrSide < 18 ? 'L' : 'M',
    showTitle,
    showSerial: h >= 28,
    border,
    title: title.trim(),
  };
}

function Label({ eq, st, pos }: { eq: Equipment; st: LabelStyle; pos?: { left: number; top: number } }) {
  return (
    <div
      style={{
        position: pos ? 'absolute' : 'relative',
        left: pos ? `${pos.left}mm` : undefined,
        top: pos ? `${pos.top}mm` : undefined,
        width: `${st.w}mm`,
        height: `${st.h}mm`,
        overflow: 'hidden',
        background: '#fff',
        color: '#000',
        border: st.border ? '0.4pt solid #000' : undefined,
        boxSizing: 'border-box',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          padding: `${st.pad}mm`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {st.showTitle && (
          <div
            style={{
              fontSize: `${st.titleSize}pt`,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {st.title}
          </div>
        )}
        <div style={{ display: 'flex', gap: '1.5mm', flex: 1, minHeight: 0, marginTop: '0.5mm' }}>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', lineHeight: 1.25 }}>
            <div
              style={{
                fontSize: `${st.nameSize}pt`,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {eq.name}
            </div>
            <div style={{ fontSize: `${st.fieldSize}pt` }}>
              <b>Inv: </b>
              {eq.code}
            </div>
            {eq.location && (
              <div
                style={{
                  fontSize: `${st.fieldSize}pt`,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <b>Ubic.: </b>
                {eq.location}
              </div>
            )}
            {st.showSerial && eq.serial && (
              <div
                style={{
                  fontSize: `${st.fieldSize}pt`,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <b>S/N: </b>
                {eq.serial}
              </div>
            )}
          </div>
          <div
            style={{ width: `${st.qrSide}mm`, height: `${st.qrSide}mm`, flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: qrSvgMarkup(equipmentUrl(eq.id), st.ecl) }}
          />
        </div>
      </div>
    </div>
  );
}

/* ============ Etiqueta grande (access points / red) ============ */

interface LargeStyle {
  w: number;
  h: number;
  pad: number;
  titleSize: number;
  nameSize: number;
  codeSize: number;
  labelSize: number;
  valueSize: number;
  macSize: number;
  qrSide: number;
  border: boolean;
  title: string;
  showTitle: boolean;
}

function largeLabelStyle(w: number, h: number, border: boolean, title: string): LargeStyle {
  // Escala proporcional respecto de la etiqueta base de 92 × 131 mm
  const k = Math.min(w / 92, h / 131);
  return {
    w,
    h,
    pad: Math.max(2.5, 4.5 * k),
    titleSize: Math.max(4.5, Math.min(13, 6.5 * k)),
    nameSize: Math.max(9, 17 * k),
    codeSize: Math.max(5.5, 8 * k),
    labelSize: Math.max(4.5, 6.5 * k),
    valueSize: Math.max(6, 9.5 * k),
    macSize: Math.max(7, 11.5 * k),
    qrSide: Math.round(Math.min(w * 0.38, h * 0.3) * 10) / 10,
    border,
    title: title.trim(),
    showTitle: title.trim() !== '',
  };
}

function LargeRow({
  label,
  value,
  st,
  mono,
  big,
}: {
  label: string;
  value: string;
  st: LargeStyle;
  mono?: boolean;
  big?: boolean;
}) {
  return (
    <div style={{ marginBottom: '1.6mm' }}>
      <div
        style={{
          fontSize: `${st.labelSize}pt`,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#444',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: `${big ? st.macSize : st.valueSize}pt`,
          fontWeight: mono ? 700 : 500,
          fontFamily: mono ? "'Courier New', Courier, monospace" : undefined,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: 1.25,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LargeLabel({ eq, st, pos }: { eq: Equipment; st: LargeStyle; pos?: { left: number; top: number } }) {
  const brandModel = [eq.brand, eq.model].filter(Boolean).join(' ');
  return (
    <div
      style={{
        position: pos ? 'absolute' : 'relative',
        left: pos ? `${pos.left}mm` : undefined,
        top: pos ? `${pos.top}mm` : undefined,
        width: `${st.w}mm`,
        height: `${st.h}mm`,
        overflow: 'hidden',
        background: '#fff',
        color: '#000',
        border: st.border ? '0.6pt solid #000' : undefined,
        boxSizing: 'border-box',
        fontFamily: 'Arial, Helvetica, sans-serif',
      }}
    >
      <div
        style={{
          padding: `${st.pad}mm`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxSizing: 'border-box',
        }}
      >
        {st.showTitle && (
          <div
            style={{
              fontSize: `${st.titleSize}pt`,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
              borderBottom: '0.3pt solid #999',
              paddingBottom: '1mm',
              marginBottom: '1.5mm',
            }}
          >
            {st.title}
          </div>
        )}
        <div
          style={{
            fontSize: `${st.nameSize}pt`,
            fontWeight: 800,
            lineHeight: 1.05,
            overflow: 'hidden',
            maxHeight: `${st.nameSize * 0.353 * 2.3}mm`,
          }}
        >
          {eq.name}
        </div>
        <div style={{ fontSize: `${st.codeSize}pt`, color: '#333', marginTop: '0.8mm' }}>
          Inv: <b>{eq.code}</b>
          {eq.location ? ` · ${eq.location}` : ''}
        </div>

        <div style={{ display: 'flex', gap: '3mm', flex: 1, minHeight: 0, marginTop: '2.5mm' }}>
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            {eq.mac && <LargeRow label="MAC" value={eq.mac} st={st} mono big />}
            {brandModel && <LargeRow label="Nombre y modelo" value={brandModel} st={st} />}
            {eq.ip && <LargeRow label="IP" value={eq.ip} st={st} mono />}
            {eq.serial && <LargeRow label="Nº de serie" value={eq.serial} st={st} />}
            {eq.notes && (
              <div style={{ marginBottom: '1.6mm', overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: `${st.labelSize}pt`,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#444',
                    lineHeight: 1.2,
                  }}
                >
                  Detalles
                </div>
                <div
                  style={{
                    fontSize: `${st.valueSize}pt`,
                    lineHeight: 1.3,
                    whiteSpace: 'pre-line',
                    overflow: 'hidden',
                  }}
                >
                  {eq.notes}
                </div>
              </div>
            )}
          </div>
          <div style={{ width: `${st.qrSide}mm`, flexShrink: 0, textAlign: 'center' }}>
            <div
              style={{ width: `${st.qrSide}mm`, height: `${st.qrSide}mm` }}
              dangerouslySetInnerHTML={{ __html: qrSvgMarkup(equipmentUrl(eq.id), 'M') }}
            />
            <div style={{ fontSize: `${st.labelSize}pt`, color: '#444', marginTop: '0.8mm' }}>
              Escanea para ver la ficha
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ Modal ============ */

interface Props {
  equipment: Equipment[];
  initialSelection?: string[];
  onClose: () => void;
}

export default function EquipmentLabelsModal({ equipment, initialSelection, onClose }: Props) {
  const [design, setDesign] = useState<LabelDesign>('estandar');
  const [presetId, setPresetId] = useState('24');
  const [startPos, setStartPos] = useState(1);
  const [copies, setCopies] = useState(1);
  const [border, setBorder] = useState(true);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelection ?? equipment.map((e) => e.id))
  );

  const presets = design === 'grande' ? LARGE_PRESETS : PRESETS;
  const preset = presets.find((p) => p.id === presetId) || presets[0];

  const st = useMemo(() => labelStyle(preset.w, preset.h, border, title), [preset, border, title]);
  const lst = useMemo(() => largeLabelStyle(preset.w, preset.h, border, title), [preset, border, title]);

  function changeDesign(d: LabelDesign) {
    setDesign(d);
    setPresetId(d === 'grande' ? LARGE_PRESETS[0].id : PRESETS[0].id);
    setStartPos(1);
  }

  // Mientras el modal esta abierto, imprimir muestra solo la plancha
  useEffect(() => {
    document.body.classList.add('printing-labels');
    return () => document.body.classList.remove('printing-labels');
  }, []);

  const selectedEqs = equipment.filter((e) => selected.has(e.id));

  const pages = useMemo(() => {
    const items: Equipment[] = [];
    for (const eq of selectedEqs) {
      for (let c = 0; c < Math.max(1, copies); c++) items.push(eq);
    }
    const perPage = preset.cols * preset.rows;
    const offset = Math.min(Math.max(1, startPos) - 1, perPage - 1);
    const result: { eq: Equipment; left: number; top: number }[][] = [];
    let page: { eq: Equipment; left: number; top: number }[] = [];
    let cell = offset;
    for (const eq of items) {
      if (cell >= perPage) {
        result.push(page);
        page = [];
        cell = 0;
      }
      const r = Math.floor(cell / preset.cols);
      const c = cell % preset.cols;
      page.push({
        eq,
        left: preset.ml + c * (preset.w + preset.gx),
        top: preset.mt + r * (preset.h + preset.gy),
      });
      cell++;
    }
    if (page.length) result.push(page);
    return result;
  }, [selectedEqs, copies, preset, startPos]);

  const totalLabels = selectedEqs.length * Math.max(1, copies);

  // Escaneabilidad estimada: mm por modulo del QR en el formato elegido
  const qrSide = design === 'grande' ? lst.qrSide : st.qrSide;
  const qrEcl: QrEcl = design === 'grande' ? 'M' : st.ecl;
  const qrCheck = useMemo(() => {
    if (!selectedEqs[0]) return null;
    const n = qrModuleCount(equipmentUrl(selectedEqs[0].id), qrEcl);
    if (!n) return null;
    const mm = qrSide / (n + 8); // incluye quiet zone de 4 modulos por lado
    const verdict =
      mm >= 0.4
        ? '✓ se escanea con cualquier celular'
        : mm >= 0.3
        ? '△ al limite: mejor elegir un formato mas grande'
        : '✕ muy denso: elegi un formato de etiqueta mas grande';
    return `QR de ${qrSide} mm · ${n}×${n} modulos · ${mm.toFixed(2)} mm/modulo — ${verdict}`;
  }, [selectedEqs, qrSide, qrEcl]);

  // Vista previa a escala cuando la etiqueta no entra en el modal
  const previewScale = Math.min(1, 400 / (preset.w * MM_TO_PX));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderLabel(eq: Equipment, pos?: { left: number; top: number }) {
    return design === 'grande' ? (
      <LargeLabel eq={eq} st={lst} pos={pos} />
    ) : (
      <Label eq={eq} st={st} pos={pos} />
    );
  }

  return (
    <>
      <Modal title="Imprimir etiquetas QR" onClose={onClose} maxWidth={720}>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Diseño</label>
              <select
                className="form-select"
                value={design}
                onChange={(e) => changeDesign(e.target.value as LabelDesign)}
              >
                <option value="estandar">Estandar (chica)</option>
                <option value="grande">Grande (access points / red)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Formato de plancha A4</label>
              <select className="form-select" value={preset.id} onChange={(e) => setPresetId(e.target.value)}>
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>{p.n}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Empezar en pos.</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max={preset.cols * preset.rows}
                value={startPos}
                onChange={(e) => setStartPos(Number(e.target.value) || 1)}
                title="Para hojas parcialmente usadas: la primera etiqueta se imprime en esta posicion"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Copias c/u</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="50"
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value) || 1)}
              />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Titulo (institucion)</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={border} onChange={(e) => setBorder(e.target.checked)} />
              Borde en la etiqueta
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">
              Equipos a imprimir ({selected.size} de {equipment.length})
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set(equipment.map((e) => e.id)))}>
                Todos
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
                Ninguno
              </button>
            </div>
            <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: 6 }}>
              {equipment.map((eq) => (
                <label
                  key={eq.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  <input type="checkbox" checked={selected.has(eq.id)} onChange={() => toggle(eq.id)} />
                  <span style={{ fontWeight: 600 }}>{eq.code}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--color-text-light)', fontSize: '0.75rem' }}>{eq.location}</span>
                </label>
              ))}
              {equipment.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: 6 }}>
                  No hay equipos cargados.
                </p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Vista previa{previewScale < 1 ? ` (al ${Math.round(previewScale * 100)} %)` : ' (tamano real)'}
            </label>
            <div style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16, display: 'flex', justifyContent: 'center', overflow: 'auto' }}>
              {selectedEqs[0] ? (
                <div
                  style={{
                    width: preset.w * MM_TO_PX * previewScale,
                    height: preset.h * MM_TO_PX * previewScale,
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                    {design === 'grande' ? (
                      <LargeLabel eq={selectedEqs[0]} st={{ ...lst, border: true }} />
                    ) : (
                      <Label eq={selectedEqs[0]} st={{ ...st, border: true }} />
                    )}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Selecciona al menos un equipo</p>
              )}
            </div>
            {qrCheck && (
              <p style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: 6, fontWeight: 600 }}>
                {qrCheck}
              </p>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 6 }}>
              El QR abre la ficha del equipo en el sistema (historial de reparaciones incluido). En el dialogo
              de impresion usa papel A4, escala 100 % y margenes en Ninguno.
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <span style={{ marginRight: 'auto', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {totalLabels} etiqueta{totalLabels !== 1 ? 's' : ''} · {pages.length} pagina{pages.length !== 1 ? 's' : ''}
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="btn btn-primary" disabled={totalLabels === 0} onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </Modal>

      {createPortal(
        <div id="label-print-root">
          {pages.map((page, i) => (
            <div key={i} className="label-page">
              {page.map((cell, j) => (
                <span key={j}>{renderLabel(cell.eq, { left: cell.left, top: cell.top })}</span>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
