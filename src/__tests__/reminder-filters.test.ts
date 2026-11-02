import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import type { Reminder } from '../types/reminder.ts';
import {
  ALL_DAYS,
  getNextOccurrence,
  getTimeInMinutes,
  isPastOnceReminder,
  occursOnDate,
  sortTodayReminders,
  sortUpcomingReminders,
} from '../utils/reminder-dates.ts';

// Helper para crear recordatorios de prueba
function createTestReminder(overrides: Partial<Reminder>): Reminder {
  return {
    id: `rem-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Recordatorio de prueba',
    time: '08:00 AM',
    frequency: 'Una vez',
    category: 'general',
    isActive: true,
    repeatType: 'once',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('Pruebas unitarias de Filtros de Recordatorios: «Hoy» y «Próximos»', () => {
  describe('1. Filtrado para recordatorios de Una Sola Vez (once)', () => {
    // Fecha simulada fija: Lunes 15 de Noviembre de 2027 a las 10:00 AM
    const simulatedToday = new Date(2027, 10, 15, 10, 0, 0, 0);

    test('Recordatorio con targetDate igual a hoy aparece en Hoy y no en Próximos', () => {
      const reminder = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-15',
        time: '02:00 PM',
      });

      assert.equal(occursOnDate(reminder, simulatedToday), true);
      assert.equal(isPastOnceReminder(reminder, simulatedToday), false);
    });

    test('Recordatorio con targetDate en el futuro aparece en Próximos y no en Hoy', () => {
      const reminder = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-20',
        time: '09:00 AM',
      });

      assert.equal(occursOnDate(reminder, simulatedToday), false);
      assert.equal(isPastOnceReminder(reminder, simulatedToday), false);

      const nextOccur = getNextOccurrence(reminder, simulatedToday);
      assert.ok(nextOccur);
      assert.equal(nextOccur.getFullYear(), 2027);
      assert.equal(nextOccur.getMonth(), 10);
      assert.equal(nextOccur.getDate(), 20);
    });

    test('Recordatorio con targetDate en el pasado (targetDate < todayStr) aparece en Próximos como Fecha pasada', () => {
      const reminder = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-10',
        time: '08:00 AM',
      });

      assert.equal(occursOnDate(reminder, simulatedToday), false);
      assert.equal(isPastOnceReminder(reminder, simulatedToday), true);
      assert.equal(getNextOccurrence(reminder, simulatedToday), null);
    });

    test('Recordatorio de una sola vez sin targetDate retorna false de forma segura', () => {
      const reminder = createTestReminder({
        repeatType: 'once',
        targetDate: undefined,
      });

      assert.equal(occursOnDate(reminder, simulatedToday), false);
      assert.equal(isPastOnceReminder(reminder, simulatedToday), false);
    });
  });

  describe('2. Filtrado para recordatorios Diarios (daily)', () => {
    test('Recordatorio diario siempre aparece en Hoy y nunca en Próximos', () => {
      const reminder = createTestReminder({
        repeatType: 'daily',
        time: '08:00 AM',
      });

      // Probado en diferentes fechas y días de la semana
      const dates = [
        new Date(2027, 0, 1), // Viernes
        new Date(2027, 1, 15), // Lunes
        new Date(2027, 6, 20), // Martes
        new Date(2028, 1, 29), // Martes bisiesto
      ];

      for (const d of dates) {
        assert.equal(occursOnDate(reminder, d), true);
      }
    });
  });

  describe('3. Filtrado para recordatorios Semanales (weekly)', () => {
    // 2027-11-15 fue Lunes (índice getDay() = 1 -> 'L')
    // 2027-11-16 fue Martes (índice getDay() = 2 -> 'M')
    // 2027-11-17 fue Miércoles (índice getDay() = 3 -> 'X')
    const monday = new Date(2027, 10, 15, 9, 0, 0, 0);
    const tuesday = new Date(2027, 10, 16, 9, 0, 0, 0);
    const wednesday = new Date(2027, 10, 17, 9, 0, 0, 0);

    test('Recordatorio semanal que coincide con el día simulado aparece en Hoy', () => {
      const reminder = createTestReminder({
        repeatType: 'weekly',
        days: ['L', 'X', 'V'], // Lunes, Miércoles, Viernes
        time: '07:30 AM',
      });

      // El lunes coincide
      assert.equal(occursOnDate(reminder, monday), true);
      // El miércoles coincide
      assert.equal(occursOnDate(reminder, wednesday), true);
    });

    test('Recordatorio semanal que no coincide con el día simulado aparece en Próximos', () => {
      const reminder = createTestReminder({
        repeatType: 'weekly',
        days: ['L', 'X', 'V'],
        time: '07:30 AM',
      });

      // El martes no coincide -> Próximos
      assert.equal(occursOnDate(reminder, tuesday), false);

      // Su próxima ocurrencia desde el martes debe ser el miércoles
      const nextOccur = getNextOccurrence(reminder, tuesday);
      assert.ok(nextOccur);
      assert.equal(nextOccur.getDate(), 17); // Miércoles 17
      assert.equal(ALL_DAYS[nextOccur.getDay()], 'X');
    });

    test('Recordatorio semanal con arreglo de días vacío no produce errores y va a Próximos', () => {
      const reminder = createTestReminder({
        repeatType: 'weekly',
        days: [],
        time: '08:00 AM',
      });

      assert.equal(occursOnDate(reminder, monday), false);
      assert.equal(getNextOccurrence(reminder, monday), null);
    });
  });

  describe('4. Filtrado para recordatorios Mensuales (monthly) y casos límite de fin de mes', () => {
    test('Recordatorio mensual en su día exacto aparece en Hoy', () => {
      const reminder = createTestReminder({
        repeatType: 'monthly',
        dayOfMonth: 15,
        time: '10:00 AM',
      });

      const day15 = new Date(2027, 4, 15, 8, 0, 0, 0); // 15 de mayo
      assert.equal(occursOnDate(reminder, day15), true);

      const day16 = new Date(2027, 4, 16, 8, 0, 0, 0); // 16 de mayo
      assert.equal(occursOnDate(reminder, day16), false);
    });

    test('Recordatorio mensual del día 31 en febrero de año normal (28 de febrero) aparece en Hoy', () => {
      const reminder = createTestReminder({
        repeatType: 'monthly',
        dayOfMonth: 31,
        time: '11:00 AM',
      });

      // 2027 no es bisiesto, febrero termina el 28
      const feb28_2027 = new Date(2027, 1, 28, 9, 0, 0, 0);
      assert.equal(occursOnDate(reminder, feb28_2027), true);

      // El 27 de febrero no debe coincidir
      const feb27_2027 = new Date(2027, 1, 27, 9, 0, 0, 0);
      assert.equal(occursOnDate(reminder, feb27_2027), false);
    });

    test('Recordatorio mensual del día 31 en febrero de año bisiesto (29 de febrero) aparece en Hoy', () => {
      const reminder = createTestReminder({
        repeatType: 'monthly',
        dayOfMonth: 31,
        time: '11:00 AM',
      });

      // 2028 es año bisiesto, febrero termina el 29
      const feb28_2028 = new Date(2028, 1, 28, 9, 0, 0, 0);
      const feb29_2028 = new Date(2028, 1, 29, 9, 0, 0, 0);

      assert.equal(occursOnDate(reminder, feb28_2028), false); // En bisiesto el 28 no es el último día
      assert.equal(occursOnDate(reminder, feb29_2028), true); // El 29 es el día efectivo
    });

    test('Recordatorio mensual del día 31 en meses de 30 días (abril, junio, septiembre, noviembre)', () => {
      const reminder = createTestReminder({
        repeatType: 'monthly',
        dayOfMonth: 31,
        time: '11:00 AM',
      });

      const apr30 = new Date(2027, 3, 30, 9, 0, 0, 0); // 30 de abril
      assert.equal(occursOnDate(reminder, apr30), true);

      const apr29 = new Date(2027, 3, 29, 9, 0, 0, 0);
      assert.equal(occursOnDate(reminder, apr29), false);
    });
  });

  describe('5. Conservación de recordatorios pausados y hora pasada en el día', () => {
    const simulatedNow = new Date(2027, 10, 15, 14, 0, 0, 0); // 2:00 PM

    test('Recordatorios pausados con fecha de hoy permanecen en Hoy', () => {
      const pausedToday = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-15',
        isActive: false,
        time: '09:00 AM',
      });

      assert.equal(occursOnDate(pausedToday, simulatedNow), true);
    });

    test('Recordatorios pausados con fecha futura permanecen en Próximos', () => {
      const pausedFuture = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-18',
        isActive: false,
        time: '09:00 AM',
      });

      assert.equal(occursOnDate(pausedFuture, simulatedNow), false);
      const nextOccur = getNextOccurrence(pausedFuture, simulatedNow);
      assert.ok(nextOccur);
    });

    test('Nunca ocultar recordatorios de hoy cuya hora ya pasó respecto a la hora actual', () => {
      // Hora simulada: 02:00 PM. Recordatorio programado para las 08:00 AM de hoy.
      const morningReminder = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-15',
        time: '08:00 AM',
      });

      // Debe permanecer en Hoy
      assert.equal(occursOnDate(morningReminder, simulatedNow), true);
      // No debe considerarse "Fecha pasada" porque pertenece al día de hoy
      assert.equal(isPastOnceReminder(morningReminder, simulatedNow), false);
    });
  });

  describe('6. Exclusión mutua (sin duplicados) entre Hoy y Próximos', () => {
    const simulatedNow = new Date(2027, 10, 15, 10, 0, 0, 0);

    test('Cada recordatorio pertenece exclusivamente a Hoy o a Próximos, nunca a ambos', () => {
      const testList: Reminder[] = [
        createTestReminder({ id: '1', repeatType: 'daily', time: '07:00 AM' }),
        createTestReminder({ id: '2', repeatType: 'once', targetDate: '2027-11-15', time: '08:00 AM' }),
        createTestReminder({ id: '3', repeatType: 'once', targetDate: '2027-11-16', time: '09:00 AM' }),
        createTestReminder({ id: '4', repeatType: 'once', targetDate: '2027-11-10', time: '10:00 AM' }), // Pasado
        createTestReminder({ id: '5', repeatType: 'weekly', days: ['L'], time: '11:00 AM' }), // Lunes (hoy)
        createTestReminder({ id: '6', repeatType: 'weekly', days: ['M', 'J'], time: '12:00 PM' }), // Martes/Jueves (futuro)
        createTestReminder({ id: '7', repeatType: 'monthly', dayOfMonth: 15, time: '01:00 PM' }), // Día 15 (hoy)
        createTestReminder({ id: '8', repeatType: 'monthly', dayOfMonth: 20, time: '02:00 PM' }), // Día 20 (futuro)
      ];

      const todayList = testList.filter((r) => occursOnDate(r, simulatedNow));
      const upcomingList = testList.filter((r) => !occursOnDate(r, simulatedNow));

      // Verificación de que la suma de elementos es exactamente igual al total
      assert.equal(todayList.length + upcomingList.length, testList.length);

      // Verificación de que ningún ID de Hoy está presente en Próximos
      const todayIds = new Set(todayList.map((r) => r.id));
      for (const item of upcomingList) {
        assert.equal(todayIds.has(item.id), false, `El recordatorio ${item.id} no debe duplicarse`);
      }

      // Recordatorios esperados en Hoy: 1 (daily), 2 (once hoy), 5 (weekly L), 7 (monthly 15)
      assert.deepEqual(
        todayList.map((r) => r.id),
        ['1', '2', '5', '7']
      );

      // Recordatorios esperados en Próximos: 3 (once futuro), 4 (once pasado), 6 (weekly MJ), 8 (monthly 20)
      assert.deepEqual(
        upcomingList.map((r) => r.id),
        ['3', '4', '6', '8']
      );
    });
  });

  describe('7. Orden cronológico en Hoy (sortTodayReminders)', () => {
    test('Ordena ascendentemente por hora (mañana antes de tarde)', () => {
      const reminders: Reminder[] = [
        createTestReminder({ id: '1', time: '11:00 PM' }),
        createTestReminder({ id: '2', time: '07:00 AM' }),
        createTestReminder({ id: '3', time: '02:30 PM' }),
        createTestReminder({ id: '4', time: '08:15 AM' }),
        createTestReminder({ id: '5', time: '12:00 PM' }), // Mediodía
        createTestReminder({ id: '6', time: '12:30 AM' }), // Medianoche
      ];

      const sorted = sortTodayReminders(reminders);
      const sortedIds = sorted.map((r) => r.id);

      // 12:30 AM (0h 30m) -> 07:00 AM -> 08:15 AM -> 12:00 PM (12h) -> 02:30 PM (14h 30m) -> 11:00 PM (23h)
      assert.deepEqual(sortedIds, ['6', '2', '4', '5', '3', '1']);
    });

    test('Conserva orden estable por createdAt si las horas son idénticas', () => {
      const reminders: Reminder[] = [
        createTestReminder({ id: 'A', time: '09:00 AM', createdAt: 200 }),
        createTestReminder({ id: 'B', time: '09:00 AM', createdAt: 100 }),
      ];

      const sorted = sortTodayReminders(reminders);
      assert.deepEqual(
        sorted.map((r) => r.id),
        ['B', 'A']
      );
    });

    test('getTimeInMinutes calcula correctamente los minutos transcurridos', () => {
      assert.equal(getTimeInMinutes('12:00 AM'), 0);
      assert.equal(getTimeInMinutes('01:15 AM'), 75);
      assert.equal(getTimeInMinutes('12:00 PM'), 720);
      assert.equal(getTimeInMinutes('01:30 PM'), 810);
      assert.equal(getTimeInMinutes('11:59 PM'), 1439);
    });
  });

  describe('8. Orden cronológico en Próximos (sortUpcomingReminders)', () => {
    // Simulado: Lunes 15 de Noviembre de 2027 a las 10:00 AM
    const simulatedNow = new Date(2027, 10, 15, 10, 0, 0, 0);

    test('Ordena recordatorios futuros del más cercano al más lejano, y pasados al final', () => {
      const rPast1 = createTestReminder({
        id: 'past-1',
        repeatType: 'once',
        targetDate: '2027-11-10',
        time: '08:00 AM',
      });
      const rPast2 = createTestReminder({
        id: 'past-2',
        repeatType: 'once',
        targetDate: '2027-11-12',
        time: '08:00 AM',
      });
      const rTomorrow = createTestReminder({
        id: 'tomorrow',
        repeatType: 'once',
        targetDate: '2027-11-16', // Mañana
        time: '08:00 AM',
      });
      const rInTwoDays = createTestReminder({
        id: 'in-2-days',
        repeatType: 'once',
        targetDate: '2027-11-17',
        time: '08:00 AM',
      });
      const rWeeklyNext = createTestReminder({
        id: 'weekly-thursday',
        repeatType: 'weekly',
        days: ['J'], // Jueves 18 de Noviembre
        time: '08:00 AM',
      });

      const upcoming = [rPast1, rInTwoDays, rPast2, rTomorrow, rWeeklyNext];
      const sorted = sortUpcomingReminders(upcoming, simulatedNow);
      const sortedIds = sorted.map((r) => r.id);

      // Futuros: tomorrow (16 nov) -> in-2-days (17 nov) -> weekly-thursday (18 nov)
      // Pasados al final: past-2 (12 nov, más reciente entre los pasados) -> past-1 (10 nov)
      assert.deepEqual(sortedIds, ['tomorrow', 'in-2-days', 'weekly-thursday', 'past-2', 'past-1']);
    });

    test('Los recordatorios de fecha pasada tienen el indicador isPastOnceReminder activo', () => {
      const pastReminder = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-01',
        time: '08:00 AM',
      });
      const futureReminder = createTestReminder({
        repeatType: 'once',
        targetDate: '2027-11-20',
        time: '08:00 AM',
      });

      assert.equal(isPastOnceReminder(pastReminder, simulatedNow), true);
      assert.equal(isPastOnceReminder(futureReminder, simulatedNow), false);
    });
  });
});
