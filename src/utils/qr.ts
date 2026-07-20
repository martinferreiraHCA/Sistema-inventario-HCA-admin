import qrcode from 'qrcode-generator';
import { APP_BASENAME } from '../config/app';

// Codificar en UTF-8 para que acentos y enie no rompan el contenido.
// (El build ESM de qrcode-generator 2.x no incluye stringToBytesFuncs;
// el default trunca a un byte por caracter.)
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

export type QrEcl = 'L' | 'M' | 'Q' | 'H';

/**
 * SVG de un codigo QR con quiet zone estandar de 4 modulos.
 * Sin `size` el SVG es escalable (100% del contenedor); con `size` lleva
 * width/height fijos en px (util para descargarlo como archivo).
 */
export function qrSvgMarkup(text: string, ecl: QrEcl = 'M', size?: number): string {
  const qr = qrcode(0, ecl);
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const q = 4;
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
  }
  const dims = size
    ? `width="${size}" height="${size}"`
    : 'style="width:100%;height:100%;display:block"';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-q} ${-q} ${n + 2 * q} ${n + 2 * q}" ` +
    `shape-rendering="crispEdges" ${dims}>` +
    `<rect x="${-q}" y="${-q}" width="${n + 2 * q}" height="${n + 2 * q}" fill="#fff"/>` +
    `<path d="${d}" fill="#000"/></svg>`
  );
}

/** URL absoluta de la ficha de un equipo (el contenido del QR de su etiqueta) */
export function equipmentUrl(equipmentId: string): string {
  return `${window.location.origin}${APP_BASENAME}/equipos/${equipmentId}`;
}

/** Cantidad de modulos por lado del QR (para estimar si es escaneable) */
export function qrModuleCount(text: string, ecl: QrEcl = 'M'): number | null {
  try {
    const qr = qrcode(0, ecl);
    qr.addData(text, 'Byte');
    qr.make();
    return qr.getModuleCount();
  } catch {
    return null;
  }
}

/** Descarga el QR como imagen PNG (1024x1024) */
export function downloadQrPng(text: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const svg = qrSvgMarkup(text, 'M', 1024);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas no disponible'));
        return;
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) {
          reject(new Error('no se pudo generar el PNG'));
          return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 400);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('no se pudo renderizar el QR'));
    };
    img.src = url;
  });
}
