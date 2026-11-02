import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Reminder } from '../types/reminder.ts';
import {
  buildDayAccessibilityLabel,
  buildMonthGridWeeks,
  buildMonthRemindersMap,
  CALENDAR_WEEK_DAYS,
  CATEGORY_DOT_COLORS,
  getDayIndicators,
  getMondayFirstIndex,
  getRemindersForDate,
  getSelectedDateOnMonthChange,
  INACTIVE_DOT_COLOR,
  navigateMonth,
  occursOnCalendarDate,
} from '../utils/calendar-utils.ts';

function createReminder(overrides: Partial<Reminder>): Reminder {
  return {
    id: `rem-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Recordatorio calendario',
    time: '08:00 AM',
    frequency: 'Una vez',
    repeatType: 'once',
    category: 'general',
    isActive: true,
    createdAt: 1, // Valor semilla anterior a cualquier fecha de prueba
    ...overrides,
  };
}

describe('Pruebas unitarias de Vista de Calendario Mensual (calendar-utils)', () => {
  describe('1. Alineación de semana L, M, X, J, V, S, D y cuadrícula mensual', () => {
    it('Los encabezados siguen el orden L, M, X, J, V, S, D', () => {
      assert.deepEqual(
        CALENDAR_WEEK_DAYS.map((d) => d.key),
        ['L', 'M', 'X', 'J', 'V', 'S', 'D']
      );
    });

    it('getMondayFirstIndex convierte correctamente Date.getDay() al índice 0..6 iniciando en Lunes', () => {
      assert.equal(getMondayFirstIndex(1), 0, 'Lunes (1) -> columna 0');
      assert.equal(getMondayFirstIndex(2), 1, 'Martes (2) -> columna 1');
      assert.equal(getMondayFirstIndex(3), 2, 'Miércoles (3) -> columna 2');
      assert.equal(getMondayFirstIndex(4), 3, 'Jueves (4) -> columna 3');
      assert.equal(getMondayFirstIndex(5), 4, 'Viernes (5) -> columna 4');
      assert.equal(getMondayFirstIndex(6), 5, 'Sábado (6) -> columna 5');
      assert.equal(getMondayFirstIndex(0), 6, 'Domingo (0) -> columna 6');
    });

    it('Genera cuadrícula correcta para un mes que comienza en Lunes (Noviembre 2027)', () => {
      // 1 de noviembre de 2027 es Lunes -> 0 celdas vacías al inicio, 30 días
      const weeks = buildMonthGridWeeks(2027, 10);
      assert.equal(weeks.length, 5);
      for (const week of weeks) {
        assert.equal(week.length, 7);
      }

      // La primera celda debe ser el día 1
      assert.equal(weeks[0][0].type, 'day');
      assert.equal(weeks[0][0].dayNumber, 1);
      assert.equal(weeks[0][0].dateStr, '2027-11-01');

      // El día 30 debe estar en la semana 5, columna Martes (índice 1)
      assert.equal(weeks[4][1].type, 'day');
      assert.equal(weeks[4][1].dayNumber, 30);
      assert.equal(weeks[4][1].dateStr, '2027-11-30');
      assert.equal(weeks[4][2].type, 'empty');
    });

    it('Genera cuadrícula correcta para un mes que comienza en Domingo (Agosto 2027)', () => {
      // 1 de agosto de 2027 es Domingo -> 6 celdas vacías al inicio (L a S), el día 1 va en columna 6 (D)
      const weeks = buildMonthGridWeeks(2027, 7);
      assert.equal(weeks.length, 6);
      for (let i = 0; i < 6; i++) {
        assert.equal(weeks[0][i].type, 'empty');
      }
      assert.equal(weeks[0][6].type, 'day');
      assert.equal(weeks[0][6].dayNumber, 1);
      assert.equal(weeks[0][6].dateStr, '2027-08-01');
    });

    it('Maneja correctamente Febrero en año normal (2027, 28 días) y año bisiesto (2028, 29 días)', () => {
      // Febrero 2027: comienza en Lunes 1 y termina en Domingo 28 -> exactamente 4 semanas sin celdas vacías
      const weeks2027 = buildMonthGridWeeks(2027, 1);
      assert.equal(weeks2027.length, 4);
      assert.equal(weeks2027[0][0].dateStr, '2027-02-01');
      assert.equal(weeks2027[3][6].dateStr, '2027-02-28');

      // Febrero 2028 (bisiesto): comienza en Martes 1 y tiene 29 días
      const weeks2028 = buildMonthGridWeeks(2028, 1);
      const allDayCells2028 = weeks2028.flat().filter((c) => c.type === 'day');
      assert.equal(allDayCells2028.length, 29);
      assert.equal(allDayCells2028[28].dayNumber, 29);
      assert.equal(allDayCells2028[28].dateStr, '2028-02-29');
    });
  });

  describe('2. Representación de recordatorios diarios, semanales, mensuales y fecha única', () => {
    it('Muestra recordatorios de una sola vez, diarios, semanales y mensuales en sus días exactos', () => {
      const reminders: Reminder[] = [
        createReminder({
          id: 'once-15',
          title: 'Cita única',
          repeatType: 'once',
          targetDate: '2027-11-15',
          time: '02:00 PM',
        }),
        createReminder({
          id: 'daily-all',
          title: 'Vitamina diaria',
          repeatType: 'daily',
          time: '08:00 AM',
        }),
        createReminder({
          id: 'weekly-mwf',
          title: 'Gimnasio',
          repeatType: 'weekly',
          days: ['L', 'X', 'V'],
          time: '07:00 AM',
        }),
        createReminder({
          id: 'monthly-20',
          title: 'Pago mensual',
          repeatType: 'monthly',
          dayOfMonth: 20,
          time: '10:00 AM',
        }),
      ];

      const map = buildMonthRemindersMap(reminders, 2027, 10); // Noviembre 2027

      // Lunes 15 de noviembre de 2027: debe tener Gimnasio (07:00 AM), Vitamina (08:00 AM), Cita única (02:00 PM)
      const nov15 = map['2027-11-15'];
      assert.ok(nov15);
      assert.deepEqual(
        nov15.map((r) => r.id),
        ['weekly-mwf', 'daily-all', 'once-15']
      );

      // Martes 16 de noviembre de 2027: solo Vitamina diaria
      const nov16 = map['2027-11-16'];
      assert.ok(nov16);
      assert.deepEqual(
        nov16.map((r) => r.id),
        ['daily-all']
      );

      // Sábado 20 de noviembre de 2027: Vitamina diaria (08:00 AM) y Pago mensual (10:00 AM)
      const nov20 = map['2027-11-20'];
      assert.ok(nov20);
      assert.deepEqual(
        nov20.map((r) => r.id),
        ['daily-all', 'monthly-20']
      );
    });

    it('Ajusta recordatorios mensuales del día 31 al último día en meses cortos y años bisiestos', () => {
      const monthly31 = createReminder({
        id: 'monthly-31',
        title: 'Cierre de mes',
        repeatType: 'monthly',
        dayOfMonth: 31,
      });

      // Febrero 2027 (año normal): aparece el 28 de febrero y no el 27
      const mapFeb2027 = buildMonthRemindersMap([monthly31], 2027, 1);
      assert.equal(mapFeb2027['2027-02-27'], undefined);
      assert.equal(mapFeb2027['2027-02-28']?.length, 1);

      // Febrero 2028 (año bisiesto): aparece el 29 de febrero y no el 28
      const mapFeb2028 = buildMonthRemindersMap([monthly31], 2028, 1);
      assert.equal(mapFeb2028['2028-02-28'], undefined);
      assert.equal(mapFeb2028['2028-02-29']?.length, 1);

      // Abril 2027 (30 días): aparece el 30 de abril
      const mapApr2027 = buildMonthRemindersMap([monthly31], 2027, 3);
      assert.equal(mapApr2027['2027-04-29'], undefined);
      assert.equal(mapApr2027['2027-04-30']?.length, 1);
    });

    it('No proyecta recordatorios recurrentes en fechas anteriores a su fecha de creación', () => {
      // Creado el 15 de noviembre de 2027 a las 10:00 AM (hora local)
      const createdDate = new Date(2027, 10, 15, 10, 0, 0, 0);
      const dailyCreatedMidMonth = createReminder({
        id: 'daily-mid-month',
        repeatType: 'daily',
        createdAt: createdDate.getTime(),
      });

      // Antes del 15 de noviembre no debe mostrarse
      assert.equal(occursOnCalendarDate(dailyCreatedMidMonth, '2027-11-01'), false);
      assert.equal(occursOnCalendarDate(dailyCreatedMidMonth, '2027-11-14'), false);

      // Desde el 15 de noviembre en adelante sí debe mostrarse
      assert.equal(occursOnCalendarDate(dailyCreatedMidMonth, '2027-11-15'), true);
      assert.equal(occursOnCalendarDate(dailyCreatedMidMonth, '2027-11-16'), true);
      assert.equal(occursOnCalendarDate(dailyCreatedMidMonth, '2027-12-01'), true);
    });

    it('Evita duplicados si la lista contiene entradas repetidas del mismo ID', () => {
      const r1 = createReminder({
        id: 'dup-1',
        repeatType: 'once',
        targetDate: '2027-11-15',
      });
      const list = getRemindersForDate([r1, r1], '2027-11-15');
      assert.equal(list.length, 1);
    });
  });

  describe('3. Indicadores de puntos, categorías y diferenciación de inactivos', () => {
    it('Usa el color de categoría para activos y color atenuado para pausados, limitando a 3 puntos + overflow', () => {
      const dayReminders: Reminder[] = [
        createReminder({ id: '1', category: 'salud', isActive: true }),
        createReminder({ id: '2', category: 'finanzas', isActive: false }), // Pausado
        createReminder({ id: '3', category: 'hogar', isActive: true }),
        createReminder({ id: '4', category: 'personal', isActive: true }),
      ];

      const summary = getDayIndicators(dayReminders);

      assert.equal(summary.totalCount, 4);
      assert.equal(summary.activeCount, 3);
      assert.equal(summary.pausedCount, 1);
      assert.equal(summary.dots.length, 3);
      assert.equal(summary.hasOverflow, true);
      assert.equal(summary.overflowCount, 1);

      // Los 3 puntos visibles priorizan los activos con sus colores de categoría
      assert.equal(summary.dots[0].color, CATEGORY_DOT_COLORS.salud);
      assert.equal(summary.dots[1].color, CATEGORY_DOT_COLORS.hogar);
      assert.equal(summary.dots[2].color, CATEGORY_DOT_COLORS.personal);

      // Si solo hay un recordatorio pausado, usa el color inactivo
      const pausedOnly = getDayIndicators([dayReminders[1]]);
      assert.equal(pausedOnly.dots.length, 1);
      assert.equal(pausedOnly.dots[0].isActive, false);
      assert.equal(pausedOnly.dots[0].color, INACTIVE_DOT_COLOR);
      assert.equal(pausedOnly.hasOverflow, false);
    });
  });

  describe('4. Navegación de meses, selección de fechas y actualización dinámica', () => {
    it('navigateMonth avanza y retrocede correctamente cruzando límites de año', () => {
      assert.deepEqual(navigateMonth(2027, 0, 'prev'), { year: 2026, month: 11 });
      assert.deepEqual(navigateMonth(2027, 11, 'next'), { year: 2028, month: 0 });
      assert.deepEqual(navigateMonth(2027, 5, 'next'), { year: 2027, month: 6 });
    });

    it('getSelectedDateOnMonthChange selecciona hoy al volver al mes actual y ajusta días 31 en meses cortos', () => {
      const simulatedToday = new Date(2027, 10, 15, 9, 0, 0, 0); // 15 de nov de 2027

      // Si teníamos seleccionado el 31 de enero de 2027 y pasamos a febrero de 2027 -> se ajusta a 2027-02-28
      assert.equal(
        getSelectedDateOnMonthChange(2027, 1, '2027-01-31', simulatedToday),
        '2027-02-28'
      );

      // Si regresamos a noviembre de 2027 (mes actual) -> selecciona hoy (2027-11-15)
      assert.equal(
        getSelectedDateOnMonthChange(2027, 10, '2027-10-05', simulatedToday),
        '2027-11-15'
      );
    });

    it('Refleja inmediatamente en el mapa del mes la creación, edición, pausa y eliminación de recordatorios', () => {
      let reminders: Reminder[] = [];

      // 1. Crear recordatorio para el 10 de noviembre de 2027
      const r1 = createReminder({
        id: 'dyn-1',
        title: 'Dentista',
        repeatType: 'once',
        targetDate: '2027-11-10',
        time: '09:00 AM',
        isActive: true,
      });
      reminders = [r1];

      let map = buildMonthRemindersMap(reminders, 2027, 10);
      assert.equal(map['2027-11-10']?.length, 1);
      assert.equal(map['2027-11-10']?.[0].title, 'Dentista');

      // 2. Editar fecha al 12 de noviembre de 2027
      reminders = reminders.map((r) =>
        r.id === 'dyn-1' ? { ...r, targetDate: '2027-11-12', title: 'Dentista actualizado' } : r
      );
      map = buildMonthRemindersMap(reminders, 2027, 10);
      assert.equal(map['2027-11-10'], undefined);
      assert.equal(map['2027-11-12']?.[0].title, 'Dentista actualizado');

      // 3. Pausar recordatorio
      reminders = reminders.map((r) => (r.id === 'dyn-1' ? { ...r, isActive: false } : r));
      map = buildMonthRemindersMap(reminders, 2027, 10);
      const indicators = getDayIndicators(map['2027-11-12']);
      assert.equal(indicators.pausedCount, 1);
      assert.equal(indicators.activeCount, 0);

      // 4. Eliminar recordatorio
      reminders = [];
      map = buildMonthRemindersMap(reminders, 2027, 10);
      assert.equal(map['2027-11-12'], undefined);
    });

    it('buildDayAccessibilityLabel describe fecha, estado hoy/seleccionado y cantidad de recordatorios', () => {
      const indicators = getDayIndicators([
        createReminder({ id: '1', isActive: true }),
        createReminder({ id: '2', isActive: false }),
      ]);
      const label = buildDayAccessibilityLabel(15, 10, 2027, true, true, indicators);
      assert.ok(label.includes('15 de noviembre de 2027'));
      assert.ok(label.includes('Hoy'));
      assert.ok(label.includes('Seleccionado'));
      assert.ok(label.includes('2 recordatorios'));
    });
  });
});
