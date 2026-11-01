export const ITEM_HEIGHT = 64;
export const VISIBLE_ITEMS = 3;
export const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

export const BASE_HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // [1, 2, ..., 12]
export const HOURS_CYCLES = 120; // 12 * 120 = 1440 elementos
export const HOURS_MIDDLE_CYCLE = Math.floor(HOURS_CYCLES / 2); // 60
export const HOURS_DATA: number[] = Array.from(
  { length: 12 * HOURS_CYCLES },
  (_, i) => BASE_HOURS[i % 12]
);

export const BASE_MINUTES = Array.from({ length: 60 }, (_, i) => (i < 10 ? `0${i}` : `${i}`)); // ['00', ..., '59']
export const MINUTES_CYCLES = 60; // 60 * 60 = 3600 elementos
export const MINUTES_MIDDLE_CYCLE = Math.floor(MINUTES_CYCLES / 2); // 30
export const MINUTES_DATA: string[] = Array.from(
  { length: 60 * MINUTES_CYCLES },
  (_, i) => BASE_MINUTES[i % 60]
);

export const PERIODS: ('a.m.' | 'p.m.')[] = ['a.m.', 'p.m.'];

/**
 * Convierte cualquier string de hora ("08:00 AM", "6:00 PM", "12:00 AM")
 * a estado interno seguro en formato 24 horas y sus componentes 12h correspondientes.
 */
export function parseTimeToState(timeStr: string): {
  hour12: number;
  minute: number;
  period: 'a.m.' | 'p.m.';
} {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|a\.?\s*m\.?|p\.?\s*m\.?)?$/i);
  let hours24 = 8;
  let minutes = 0;

  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[3]?.toLowerCase();

    const isPM = ampm && (ampm.includes('p') || ampm === 'pm');
    const isAM = ampm && (ampm.includes('a') || ampm === 'am');

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    hours24 = Math.max(0, Math.min(23, h));
    minutes = Math.max(0, Math.min(59, m));
  }

  // De 24h a 12h
  const isPM = hours24 >= 12;
  let hour12 = hours24 % 12;
  if (hour12 === 0) hour12 = 12;

  return {
    hour12,
    minute: minutes,
    period: isPM ? 'p.m.' : 'a.m.',
  };
}

/**
 * Convierte la selección de 12 horas a string final formateado para Remind: "08:00 AM" / "12:00 PM"
 */
export function formatSelectedTime(hour12: number, minute: number, period: 'a.m.' | 'p.m.'): string {
  const ampm = period === 'p.m.' ? 'PM' : 'AM';
  const hStr = hour12 < 10 ? `0${hour12}` : `${hour12}`;
  const mStr = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hStr}:${mStr} ${ampm}`;
}

/**
 * Calcula el índice base (0..N-1) a partir de cualquier índice absoluto de la rueda repetida.
 */
export function getBaseIndex(fullIndex: number, baseCount: number): number {
  const mod = fullIndex % baseCount;
  return mod < 0 ? mod + baseCount : mod;
}

/**
 * Determina si el índice actual ha derivado demasiado cerca de los extremos y requiere recentrado.
 */
export function shouldRecenter(
  currentCycle: number,
  minThreshold: number,
  maxThreshold: number
): boolean {
  return currentCycle < minThreshold || currentCycle > maxThreshold;
}

