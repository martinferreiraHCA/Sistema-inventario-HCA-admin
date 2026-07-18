const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};

const DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTIONS,
  hour: '2-digit',
  minute: '2-digit',
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-UY', DATE_OPTIONS);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('es-UY', DATETIME_OPTIONS);
}

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
