export const ALL_DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

export const WEEK_DAYS: { key: string; label: string; full: string; short: string }[] = [
  { key: 'D', label: 'D', full: 'Domingo', short: 'Dom' },
  { key: 'L', label: 'L', full: 'Lunes', short: 'Lun' },
  { key: 'M', label: 'M', full: 'Martes', short: 'Mar' },
  { key: 'X', label: 'X', full: 'Miércoles', short: 'Mié' },
  { key: 'J', label: 'J', full: 'Jueves', short: 'Jue' },
  { key: 'V', label: 'V', full: 'Viernes', short: 'Vie' },
  { key: 'S', label: 'S', full: 'Sábado', short: 'Sáb' },
];

const DAY_NAMES_MAP: Record<string, string> = {
  D: 'Dom',
  L: 'Lun',
  M: 'Mar',
  X: 'Mié',
  J: 'Jue',
  V: 'Vie',
  S: 'Sáb',
};

/**
 * Conversión de claves de días ('D', 'L', 'M', 'X', 'J', 'V', 'S')
 * al formato esperado por Expo Notifications en triggers semanales,
 * donde Domingo = 1 y Sábado = 7.
 */
export const DAY_KEY_TO_EXPO_WEEKDAY: Record<string, number> = {
  D: 1, // Domingo
  L: 2, // Lunes
  M: 3, // Martes
  X: 4, // Miércoles
  J: 5, // Jueves
  V: 6, // Viernes
  S: 7, // Sábado
};

export const EXPO_WEEKDAY_TO_NAME: Record<number, string> = {
  1: 'Domingo',
  2: 'Lunes',
  3: 'Martes',
  4: 'Miércoles',
  5: 'Jueves',
  6: 'Viernes',
  7: 'Sábado',
};

/**
 * Genera el resumen en español de los días seleccionados tal como en la referencia.
 * Ejemplo: "Cada Lun, Mar, Mié, Jue, Vie" o "Cada Mar, Jue" o "Todos los días".
 */
export function formatDaysSummary(days: string[]): string {
  const ordered = ALL_DAYS.filter((d) => days.includes(d));
  if (ordered.length === 7) return 'Todos los días';
  if (ordered.length === 0) return 'Selecciona al menos un día';
  if (ordered.join('') === 'LMXJV') return 'Cada Lun, Mar, Mié, Jue, Vie';
  if (ordered.join('') === 'MJ') return 'Cada Mar, Jue';
  if (ordered.join('') === 'DS') return 'Fines de semana (Sáb, Dom)';
  return `Cada ${ordered.map((d) => DAY_NAMES_MAP[d] ?? d).join(', ')}`;
}

/**
 * Si un mes no tiene el día seleccionado (por ejemplo el día 31 en febrero o abril),
 * calcula el último día disponible de ese mes sin alterar el valor original guardado.
 */
export function getEffectiveMonthlyDay(
  dayOfMonth: number,
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth()
): number {
  // Día 0 del mes siguiente nos da el último día del mes actual (1-indexado)
  const lastDayOfCurrentMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(dayOfMonth, lastDayOfCurrentMonth);
}

/**
 * Convierte una hora en formato "08:30 AM" o "8:30 PM" a objeto Date de hoy.
 */
export function parseTimeString(timeStr: string): Date {
  const d = new Date();
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3]?.toUpperCase();

    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    d.setHours(hours, minutes, 0, 0);
  } else {
    d.setHours(8, 0, 0, 0);
  }
  return d;
}

/**
 * Formatea un objeto Date a string "08:00 AM".
 */
export function formatTimeString(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = hours < 10 ? `0${hours}` : `${hours}`;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;

  return `${formattedHours}:${formattedMinutes} ${ampm}`;
}

/**
 * Retorna la fecha local en formato "YYYY-MM-DD" sin sesgo por zona horaria UTC.
 */
export function getLocalDateString(dateInput: Date = new Date()): string {
  const y = dateInput.getFullYear();
  const m = dateInput.getMonth() + 1;
  const d = dateInput.getDate();
  const mStr = m < 10 ? `0${m}` : `${m}`;
  const dStr = d < 10 ? `0${d}` : `${d}`;
  return `${y}-${mStr}-${dStr}`;
}

/**
 * Parsea un string YYYY-MM-DD a objeto Date local a medianoche.
 */
export function parseLocalDateString(dateStr: string): Date {
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  }
  return new Date();
}

/**
 * Formatea una fecha YYYY-MM-DD a formato amigable en español.
 * Ejemplo: "31 de oct. de 2026"
 */
export function formatDateSpanish(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? parseLocalDateString(dateInput) : dateInput;
  const meses = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]}. de ${d.getFullYear()}`;
}

/**
 * Verifica si una fecha específica con hora ya ha pasado en el tiempo actual.
 */
export function isDateTimeInPast(dateString: string, timeString: string): boolean {
  const [yearStr, monthStr, dayStr] = dateString.split('-');
  if (!yearStr || !monthStr || !dayStr) return false;

  const targetDate = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10)
  );

  const parsedTime = parseTimeString(timeString);
  targetDate.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);

  return targetDate.getTime() <= Date.now();
}

