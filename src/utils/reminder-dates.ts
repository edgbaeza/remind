import type { Reminder } from '../types/reminder.ts';

export const WEEK_DAYS: { key: string; label: string; full: string; short: string }[] = [
  { key: 'D', label: 'D', full: 'Domingo', short: 'Dom' },
  { key: 'L', label: 'L', full: 'Lunes', short: 'Lun' },
  { key: 'M', label: 'M', full: 'Martes', short: 'Mar' },
  { key: 'X', label: 'X', full: 'Miércoles', short: 'Mié' },
  { key: 'J', label: 'J', full: 'Jueves', short: 'Jue' },
  { key: 'V', label: 'V', full: 'Viernes', short: 'Vie' },
  { key: 'S', label: 'S', full: 'Sábado', short: 'Sáb' },
];

export const ALL_DAYS = WEEK_DAYS.map((w) => w.key);

const DAY_NAMES_MAP: Record<string, string> = Object.fromEntries(
  WEEK_DAYS.map((w) => [w.key, w.short])
);

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

/**
 * Genera el resumen en español de los días seleccionados.
 * Ejemplo: "Lun, Mar, Mié, Jue, Vie", "Mar, Jue", "Todos los días".
 */
export function formatDaysSummary(days: string[]): string {
  const ordered = ALL_DAYS.filter((d) => days.includes(d));
  if (ordered.length === 7) return 'Todos los días';
  if (ordered.length === 0) return 'Selecciona al menos un día';
  if (ordered.join('') === 'LMXJV') return 'Lun, Mar, Mié, Jue, Vie';
  if (ordered.join('') === 'MJ') return 'Mar, Jue';
  if (ordered.join('') === 'DS') return 'Fines de semana (Sáb, Dom)';
  return ordered.map((d) => DAY_NAMES_MAP[d] ?? d).join(', ');
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
 * Calcula las próximas fechas concretas para un recordatorio mensual de día específico
 * (especialmente para días variables 29, 30 y 31) a lo largo de un horizonte de meses.
 * Si un mes tiene menos días, ajusta al último día disponible de ese mes sin alterar
 * el día original para los meses posteriores.
 * Utiliza exclusivamente el calendario y la hora local sin sesgos UTC.
 */
export function calculateMonthlyOccurrences(
  dayOfMonth: number,
  timeStr: string,
  monthsCount: number = 24,
  fromDate: Date = new Date()
): Date[] {
  const occurrences: Date[] = [];
  const parsedTime = parseTimeString(timeStr);
  const targetHour = parsedTime.getHours();
  const targetMinute = parsedTime.getMinutes();

  const startYear = fromDate.getFullYear();
  const startMonth = fromDate.getMonth();

  let offset = 0;
  // Buscamos hasta cubrir monthsCount ocurrencias futuras
  while (occurrences.length < monthsCount && offset < monthsCount + 3) {
    const curDate = new Date(startYear, startMonth + offset, 1);
    const y = curDate.getFullYear();
    const m = curDate.getMonth();

    const effectiveDay = getEffectiveMonthlyDay(dayOfMonth, y, m);
    const candidate = new Date(y, m, effectiveDay, targetHour, targetMinute, 0, 0);

    // Solo incluimos ocurrencias estrictamente futuras respecto a fromDate
    if (candidate.getTime() > fromDate.getTime()) {
      occurrences.push(candidate);
    }
    offset++;
  }

  return occurrences;
}

/**
 * Formatea una lista de ocurrencias mensuales para inspección diagnóstica.
 */
export function formatMonthlyOccurrencePreview(dates: Date[]): string[] {
  return dates.map((d) => {
    return `${formatDateSpanish(d)} a las ${formatTimeString(d)}`;
  });
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
  const parts = dateString.split('-').map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return false;
  }

  const targetDate = parseLocalDateString(dateString);
  const parsedTime = parseTimeString(timeString);
  targetDate.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);

  return targetDate.getTime() <= Date.now();
}

/**
 * Determina si la programación de un recordatorio coincide con una fecha local concreta.
 * No evalúa la hora ni si el recordatorio está pausado (los pausados pertenecen a su fecha).
 * Opera con el calendario local para evitar desfasajes por zona horaria UTC.
 */
export function occursOnDate(reminder: Reminder, dateInput: Date | string): boolean {
  const d = typeof dateInput === 'string' ? parseLocalDateString(dateInput) : dateInput;
  const targetYear = d.getFullYear();
  const targetMonth = d.getMonth();
  const targetDay = d.getDate();
  const dateStr = getLocalDateString(d);

  const repeatType = reminder.repeatType ?? 'once';

  switch (repeatType) {
    case 'once': {
      if (!reminder.targetDate) return false;
      return reminder.targetDate === dateStr;
    }

    case 'daily': {
      return true;
    }

    case 'weekly': {
      if (!reminder.days || reminder.days.length === 0) return false;
      const dayKey = ALL_DAYS[d.getDay()];
      return reminder.days.includes(dayKey);
    }

    case 'monthly': {
      const scheduledDay = reminder.dayOfMonth ?? 1;
      const effectiveDay = getEffectiveMonthlyDay(scheduledDay, targetYear, targetMonth);
      return targetDay === effectiveDay;
    }

    default:
      return false;
  }
}

/**
 * Extrae los minutos transcurridos desde la medianoche para ordenar cronológicamente por hora.
 */
export function getTimeInMinutes(timeStr: string): number {
  const parsed = parseTimeString(timeStr);
  return parsed.getHours() * 60 + parsed.getMinutes();
}

/**
 * Ordena los recordatorios del día actual en orden cronológico ascendente de hora.
 */
export function sortTodayReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => {
    const timeDiff = getTimeInMinutes(a.time) - getTimeInMinutes(b.time);
    if (timeDiff !== 0) return timeDiff;
    return a.createdAt - b.createdAt;
  });
}

/**
 * Determina si un recordatorio de una sola vez ya ha pasado su fecha programada.
 * Los recordatorios con targetDate < todayStr se consideran de fecha pasada.
 */
export function isPastOnceReminder(reminder: Reminder, fromDate: Date = new Date()): boolean {
  const repeatType = reminder.repeatType ?? 'once';
  if (repeatType !== 'once' || !reminder.targetDate) return false;

  const todayStr = getLocalDateString(fromDate);
  return reminder.targetDate < todayStr;
}

/**
 * Calcula la siguiente ocurrencia futura estricta de un recordatorio a partir de una fecha/hora de referencia.
 * Retorna un objeto Date con la fecha y hora local exactas, o null si el recordatorio ya pasó y no se repite.
 */
export function getNextOccurrence(reminder: Reminder, fromDate: Date = new Date()): Date | null {
  const repeatType = reminder.repeatType ?? 'once';
  const parsedTime = parseTimeString(reminder.time);
  const targetHour = parsedTime.getHours();
  const targetMinute = parsedTime.getMinutes();

  switch (repeatType) {
    case 'once': {
      if (!reminder.targetDate) return null;
      const target = parseLocalDateString(reminder.targetDate);
      target.setHours(targetHour, targetMinute, 0, 0);
      return target.getTime() > fromDate.getTime() ? target : null;
    }

    case 'daily': {
      const todayOccurrence = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate(),
        targetHour,
        targetMinute,
        0,
        0
      );
      if (todayOccurrence.getTime() > fromDate.getTime()) {
        return todayOccurrence;
      }
      return new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate() + 1,
        targetHour,
        targetMinute,
        0,
        0
      );
    }

    case 'weekly': {
      if (!reminder.days || reminder.days.length === 0) return null;
      const startYear = fromDate.getFullYear();
      const startMonth = fromDate.getMonth();
      const startDay = fromDate.getDate();

      for (let i = 1; i <= 7; i++) {
        const candidate = new Date(
          startYear,
          startMonth,
          startDay + i,
          targetHour,
          targetMinute,
          0,
          0
        );
        const dayKey = ALL_DAYS[candidate.getDay()];
        if (reminder.days.includes(dayKey)) {
          return candidate;
        }
      }
      return null;
    }

    case 'monthly': {
      const targetDay = reminder.dayOfMonth ?? 1;
      const occurrences = calculateMonthlyOccurrences(targetDay, reminder.time, 1, fromDate);
      return occurrences.length > 0 ? occurrences[0] : null;
    }

    default:
      return null;
  }
}

/**
 * Ordena los recordatorios próximos:
 * 1. Primero los recordatorios futuros ordenados por su próxima ocurrencia (del más cercano al más lejano).
 * 2. Al final, los recordatorios de una sola vez que ya pasaron su fecha ("Fecha pasada").
 */
export function sortUpcomingReminders(
  reminders: Reminder[],
  fromDate: Date = new Date()
): Reminder[] {
  return [...reminders].sort((a, b) => {
    const isPastA = isPastOnceReminder(a, fromDate);
    const isPastB = isPastOnceReminder(b, fromDate);

    // Los recordatorios de fecha pasada siempre van al final
    if (!isPastA && isPastB) return -1;
    if (isPastA && !isPastB) return 1;

    // Si ambos ya pasaron, ordenar por fecha descendente (los más recientes primero)
    if (isPastA && isPastB) {
      const keyA = `${a.targetDate ?? ''} ${a.time}`;
      const keyB = `${b.targetDate ?? ''} ${b.time}`;
      return keyB.localeCompare(keyA);
    }

    // Ambos son futuros: ordenar por su siguiente ocurrencia más cercana
    const nextA = getNextOccurrence(a, fromDate);
    const nextB = getNextOccurrence(b, fromDate);

    if (nextA && nextB) {
      const diff = nextA.getTime() - nextB.getTime();
      if (diff !== 0) return diff;
      return getTimeInMinutes(a.time) - getTimeInMinutes(b.time);
    }

    if (nextA && !nextB) return -1;
    if (!nextA && nextB) return 1;

    return a.createdAt - b.createdAt;
  });
}
