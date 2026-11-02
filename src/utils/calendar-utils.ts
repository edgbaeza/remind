import type { Reminder, ReminderCategory } from '../types/reminder.ts';
import {
  getEffectiveMonthlyDay,
  getLocalDateString,
  occursOnDate,
  parseLocalDateString,
  sortTodayReminders,
} from './reminder-dates.ts';

export const CALENDAR_WEEK_DAYS = [
  { key: 'L', label: 'L', full: 'Lunes' },
  { key: 'M', label: 'M', full: 'Martes' },
  { key: 'X', label: 'X', full: 'Miércoles' },
  { key: 'J', label: 'J', full: 'Jueves' },
  { key: 'V', label: 'V', full: 'Viernes' },
  { key: 'S', label: 'S', full: 'Sábado' },
  { key: 'D', label: 'D', full: 'Domingo' },
] as const;

export const SPANISH_MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

export const CATEGORY_DOT_COLORS: Record<ReminderCategory, string> = {
  salud: '#10B981',
  hogar: '#F59E0B',
  finanzas: '#3B82F6',
  personal: '#A855F7',
  general: '#94A3B8',
};

export const INACTIVE_DOT_COLOR = '#64748B';
export const MAX_CALENDAR_DOTS = 3;

// Umbral para distinguir timestamps reales (> 2 de enero de 1970) de valores semilla (1, 2, 3)
const MIN_REAL_CREATED_AT_TIMESTAMP = 86_400_000;

export interface CalendarDayCell {
  type: 'empty' | 'day';
  key: string;
  dayNumber?: number;
  dateStr?: string;
}

export interface DayIndicatorDot {
  id: string;
  category: ReminderCategory;
  isActive: boolean;
  color: string;
}

export interface DayIndicatorsSummary {
  dots: DayIndicatorDot[];
  hasOverflow: boolean;
  overflowCount: number;
  totalCount: number;
  activeCount: number;
  pausedCount: number;
}

/**
 * Convierte el índice de Date.getDay() (0 = Domingo ... 6 = Sábado)
 * al índice de columna con semana iniciada en Lunes (0 = Lunes ... 6 = Domingo).
 */
export function getMondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

/**
 * Construye la cuadrícula mensual dividida en filas de 7 columnas (L, M, X, J, V, S, D).
 */
export function buildMonthGridWeeks(year: number, month: number): CalendarDayCell[][] {
  const firstDate = new Date(year, month, 1, 0, 0, 0, 0);
  const leadingEmptyCount = getMondayFirstIndex(firstDate.getDay());
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarDayCell[] = [];

  for (let i = 0; i < leadingEmptyCount; i++) {
    cells.push({
      type: 'empty',
      key: `empty-start-${year}-${month}-${i}`,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day, 0, 0, 0, 0);
    const dateStr = getLocalDateString(dateObj);
    cells.push({
      type: 'day',
      key: dateStr,
      dayNumber: day,
      dateStr,
    });
  }

  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const trailingEmptyCount = 7 - remainder;
    for (let i = 0; i < trailingEmptyCount; i++) {
      cells.push({
        type: 'empty',
        key: `empty-end-${year}-${month}-${i}`,
      });
    }
  }

  const weeks: CalendarDayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

/**
 * Evalúa si un recordatorio debe mostrarse en una fecha del calendario.
 * Reutiliza occursOnDate(reminder, date) y evita proyectar recordatorios recurrentes
 * en fechas anteriores a su fecha de creación cuando createdAt es un timestamp real.
 */
export function occursOnCalendarDate(reminder: Reminder, dateInput: Date | string): boolean {
  if (!occursOnDate(reminder, dateInput)) {
    return false;
  }

  const repeatType = reminder.repeatType ?? 'once';
  if (
    repeatType !== 'once' &&
    typeof reminder.createdAt === 'number' &&
    reminder.createdAt > MIN_REAL_CREATED_AT_TIMESTAMP
  ) {
    const targetDateStr =
      typeof dateInput === 'string' ? dateInput : getLocalDateString(dateInput);
    const createdDateStr = getLocalDateString(new Date(reminder.createdAt));
    if (targetDateStr < createdDateStr) {
      return false;
    }
  }

  return true;
}

/**
 * Obtiene los recordatorios que corresponden a una fecha específica,
 * sin duplicados y ordenados por hora ascendente.
 */
export function getRemindersForDate(
  reminders: Reminder[],
  dateInput: Date | string
): Reminder[] {
  const seenIds = new Set<string>();
  const matching: Reminder[] = [];

  for (const r of reminders) {
    if (seenIds.has(r.id)) continue;
    if (occursOnCalendarDate(r, dateInput)) {
      seenIds.add(r.id);
      matching.push(r);
    }
  }

  return sortTodayReminders(matching);
}

/**
 * Construye un mapa indexado por fecha ("YYYY-MM-DD") con los recordatorios
 * de todos los días del mes visible.
 */
export function buildMonthRemindersMap(
  reminders: Reminder[],
  year: number,
  month: number
): Record<string, Reminder[]> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const map: Record<string, Reminder[]> = {};

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day, 0, 0, 0, 0);
    const dateStr = getLocalDateString(dateObj);
    const list = getRemindersForDate(reminders, dateObj);
    if (list.length > 0) {
      map[dateStr] = list;
    }
  }

  return map;
}

/**
 * Calcula los indicadores visuales (puntos de categoría) para un día del calendario.
 * Prioriza los recordatorios activos antes que los pausados y limita a maxDots puntos.
 */
export function getDayIndicators(
  dayReminders: Reminder[] | undefined,
  maxDots: number = MAX_CALENDAR_DOTS
): DayIndicatorsSummary {
  if (!dayReminders || dayReminders.length === 0) {
    return {
      dots: [],
      hasOverflow: false,
      overflowCount: 0,
      totalCount: 0,
      activeCount: 0,
      pausedCount: 0,
    };
  }

  let activeCount = 0;
  let pausedCount = 0;
  for (const r of dayReminders) {
    if (r.isActive) {
      activeCount++;
    } else {
      pausedCount++;
    }
  }

  // Ordenar activos primero conservando el orden horario relativo
  const prioritized = [...dayReminders].sort((a, b) => {
    if (a.isActive === b.isActive) return 0;
    return a.isActive ? -1 : 1;
  });

  const visibleSlice = prioritized.slice(0, maxDots);
  const dots: DayIndicatorDot[] = visibleSlice.map((r) => {
    const category: ReminderCategory = r.category ?? 'general';
    return {
      id: r.id,
      category,
      isActive: r.isActive,
      color: r.isActive ? CATEGORY_DOT_COLORS[category] : INACTIVE_DOT_COLOR,
    };
  });

  const totalCount = dayReminders.length;
  const hasOverflow = totalCount > maxDots;
  const overflowCount = hasOverflow ? totalCount - maxDots : 0;

  return {
    dots,
    hasOverflow,
    overflowCount,
    totalCount,
    activeCount,
    pausedCount,
  };
}

/**
 * Calcula el año y mes resultante al avanzar o retroceder un mes.
 */
export function navigateMonth(
  year: number,
  month: number,
  direction: 'prev' | 'next'
): { year: number; month: number } {
  if (direction === 'prev') {
    return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  }
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

/**
 * Determina la fecha seleccionada al cambiar de mes:
 * - Si el mes destino es el mes actual, selecciona la fecha de hoy.
 * - En otro mes, conserva el día seleccionado ajustándolo al último día disponible del mes.
 */
export function getSelectedDateOnMonthChange(
  targetYear: number,
  targetMonth: number,
  currentSelectedDateStr: string,
  todayDate: Date = new Date()
): string {
  if (
    targetYear === todayDate.getFullYear() &&
    targetMonth === todayDate.getMonth()
  ) {
    return getLocalDateString(todayDate);
  }

  const parsedCurrent = parseLocalDateString(currentSelectedDateStr);
  const currentDay = parsedCurrent.getDate();
  const effectiveDay = getEffectiveMonthlyDay(currentDay, targetYear, targetMonth);
  return getLocalDateString(new Date(targetYear, targetMonth, effectiveDay, 0, 0, 0, 0));
}

/**
 * Genera la etiqueta accesible completa para una celda de día en el calendario.
 */
export function buildDayAccessibilityLabel(
  dayNumber: number,
  month: number,
  year: number,
  isToday: boolean,
  isSelected: boolean,
  indicators: DayIndicatorsSummary
): string {
  const monthName = SPANISH_MONTH_NAMES[month]?.toLowerCase() ?? '';
  const parts: string[] = [`${dayNumber} de ${monthName} de ${year}`];

  if (isToday) {
    parts.push('Hoy');
  }
  if (isSelected) {
    parts.push('Seleccionado');
  }

  if (indicators.totalCount === 0) {
    parts.push('Sin recordatorios');
  } else if (indicators.totalCount === 1) {
    parts.push(
      indicators.activeCount === 1
        ? '1 recordatorio activo'
        : '1 recordatorio pausado'
    );
  } else {
    parts.push(`${indicators.totalCount} recordatorios`);
    if (indicators.pausedCount > 0 && indicators.activeCount > 0) {
      parts.push(`(${indicators.activeCount} activos, ${indicators.pausedCount} pausados)`);
    }
  }

  return parts.join(', ');
}
