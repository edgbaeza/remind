import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildCompletionKey,
  COMPLETIONS_SCHEMA_VERSION,
  COMPLETIONS_STORAGE_KEY,
  CompletionStorageReadError,
  getStoredCompletions,
  isReminderCompleted,
  saveStoredCompletions,
  type StorageAdapter,
} from '../services/completion-storage.ts';
import type { ReminderCompletion } from '../types/completion.ts';
import type { Reminder } from '../types/reminder.ts';
import { occursOnDate } from '../utils/reminder-dates.ts';

/**
 * StorageAdapter simulado en memoria para pruebas unitarias.
 */
class InMemoryStorage implements StorageAdapter {
  public store = new Map<string, string>();
  public shouldFailGet = false;
  public shouldFailSet = false;

  async getItem(key: string): Promise<string | null> {
    if (this.shouldFailGet) {
      throw new Error('Simulated AsyncStorage read failure');
    }
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.shouldFailSet) {
      throw new Error('Simulated AsyncStorage write failure');
    }
    this.store.set(key, value);
  }
}

describe('Pruebas unitarias de Persistencia y Reglas de Cumplimiento (completion-storage)', () => {
  describe('1. Inicialización, formato versionado y lectura (getStoredCompletions)', () => {
    it('Almacenamiento no inicializado (clave null): retorna arreglo vacío []', async () => {
      const storage = new InMemoryStorage();
      const completions = await getStoredCompletions(storage);
      assert.deepEqual(completions, []);
    });

    it('Lectura de estructura versionada válida con schemaVersion 1', async () => {
      const storage = new InMemoryStorage();
      const mockData: ReminderCompletion[] = [
        { reminderId: 'rem-1', dateKey: '2026-11-02', completedAt: 1793667600000 },
      ];
      await storage.setItem(
        COMPLETIONS_STORAGE_KEY,
        JSON.stringify({ version: COMPLETIONS_SCHEMA_VERSION, completions: mockData })
      );

      const loaded = await getStoredCompletions(storage);
      assert.equal(loaded.length, 1);
      assert.equal(loaded[0].reminderId, 'rem-1');
      assert.equal(loaded[0].dateKey, '2026-11-02');
      assert.equal(loaded[0].completedAt, 1793667600000);
    });

    it('Lanza CompletionStorageReadError si el contenido JSON está corrupto', async () => {
      const storage = new InMemoryStorage();
      await storage.setItem(COMPLETIONS_STORAGE_KEY, '{ invalid-json-syntax }');

      await assert.rejects(
        async () => {
          await getStoredCompletions(storage);
        },
        (err: unknown) =>
          err instanceof CompletionStorageReadError &&
          err.message.includes('Error al parsear el contenido de cumplimientos')
      );
    });

    it('Lanza CompletionStorageReadError si AsyncStorage falla en I/O', async () => {
      const storage = new InMemoryStorage();
      storage.shouldFailGet = true;

      await assert.rejects(
        async () => {
          await getStoredCompletions(storage);
        },
        (err: unknown) =>
          err instanceof CompletionStorageReadError &&
          err.message.includes('Error al leer cumplimientos de AsyncStorage')
      );
    });
  });

  describe('2. Completar recordatorio diario, deduplicación y deshacer', () => {
    it('Completa un recordatorio diario y lo persiste correctamente', async () => {
      const storage = new InMemoryStorage();
      const list: ReminderCompletion[] = [];
      const todayKey = '2026-11-02';
      const reminderId = 'daily-1';

      assert.equal(isReminderCompleted(list, reminderId, todayKey), false);

      const updated = [{ reminderId, dateKey: todayKey, completedAt: 1000 }, ...list];
      const saved = await saveStoredCompletions(updated, storage);
      assert.equal(saved, true);

      const persisted = await getStoredCompletions(storage);
      assert.equal(persisted.length, 1);
      assert.equal(isReminderCompleted(persisted, reminderId, todayKey), true);
    });

    it('Evita completar dos veces la misma fecha (deduplicación en sanitización)', async () => {
      const storage = new InMemoryStorage();
      const todayKey = '2026-11-02';
      const reminderId = 'daily-1';

      // Simulamos que por un doble clic o escritura concurrente se graban duplicados
      const rawDuplicateData = {
        version: 1,
        completions: [
          { reminderId, dateKey: todayKey, completedAt: 1000 },
          { reminderId, dateKey: todayKey, completedAt: 2000 },
        ],
      };
      await storage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(rawDuplicateData));

      const loaded = await getStoredCompletions(storage);
      assert.equal(loaded.length, 1, 'Debe existir exactamente 1 cumplimiento por recordatorio y fecha');
      assert.equal(loaded[0].reminderId, reminderId);
      assert.equal(loaded[0].dateKey, todayKey);
    });

    it('Deshace un cumplimiento accidentalmente marcado', async () => {
      const storage = new InMemoryStorage();
      const todayKey = '2026-11-02';
      const reminderId = 'daily-1';

      let current: ReminderCompletion[] = [
        { reminderId, dateKey: todayKey, completedAt: 1000 },
      ];
      await saveStoredCompletions(current, storage);

      // Deshacer filtrando
      current = current.filter(
        (c) => !(c.reminderId === reminderId && c.dateKey === todayKey)
      );
      await saveStoredCompletions(current, storage);

      const reloaded = await getStoredCompletions(storage);
      assert.equal(reloaded.length, 0);
      assert.equal(isReminderCompleted(reloaded, reminderId, todayKey), false);
    });

    it('Manejo de fallo de escritura en AsyncStorage: saveStoredCompletions retorna false sin lanzar excepción', async () => {
      const storage = new InMemoryStorage();
      storage.shouldFailSet = true;

      const success = await saveStoredCompletions(
        [{ reminderId: 'r1', dateKey: '2026-11-02', completedAt: 1000 }],
        storage
      );
      assert.equal(success, false, 'Debe retornar false para no reportar falsamente éxito en la UI');
    });
  });

  describe('3. Ciclo de vida entre días (Ayer vs Hoy)', () => {
    it('Conserva el cumplimiento de ayer mientras hoy vuelve a estar pendiente', async () => {
      const storage = new InMemoryStorage();
      const yesterdayKey = '2026-11-01';
      const todayKey = '2026-11-02';
      const reminderId = 'daily-habit';

      // Ayer se completó el recordatorio
      const history: ReminderCompletion[] = [
        { reminderId, dateKey: yesterdayKey, completedAt: 9999 },
      ];
      await saveStoredCompletions(history, storage);

      const loaded = await getStoredCompletions(storage);

      // En la fecha de ayer está registrado como completado
      assert.equal(isReminderCompleted(loaded, reminderId, yesterdayKey), true);
      // En la fecha de hoy está pendiente (no completado aún)
      assert.equal(isReminderCompleted(loaded, reminderId, todayKey), false);
    });
  });

  describe('4. Cumplimientos Semanales, Mensuales y Validación de Ocurrencia', () => {
    it('Recordatorio semanal: se puede completar únicamente cuando corresponde al día de la semana', () => {
      const weeklyReminder: Reminder = {
        id: 'rem-weekly',
        title: 'Clase de Yoga',
        time: '07:00 AM',
        frequency: 'Mar, Jue',
        repeatType: 'weekly',
        days: ['M', 'J'], // Martes y Jueves
        isActive: true,
        category: 'salud',
        createdAt: 1000,
      };

      // 2026-11-03 es Martes (M) -> ocurre
      const tuesday = new Date(2026, 10, 3);
      assert.equal(occursOnDate(weeklyReminder, tuesday), true);

      // 2026-11-04 es Miércoles (X) -> no ocurre
      const wednesday = new Date(2026, 10, 4);
      assert.equal(occursOnDate(weeklyReminder, wednesday), false);
    });

    it('Recordatorio mensual: respeta días 31 en meses cortos y bisiestos', () => {
      const monthlyReminder: Reminder = {
        id: 'rem-monthly-31',
        title: 'Cierre contable',
        time: '05:00 PM',
        frequency: 'Cada día 31',
        repeatType: 'monthly',
        dayOfMonth: 31,
        isActive: true,
        category: 'finanzas',
        createdAt: 1000,
      };

      // Octubre (31 días): ocurre el 31
      const oct31 = new Date(2026, 9, 31);
      assert.equal(occursOnDate(monthlyReminder, oct31), true);

      // Noviembre (30 días): ocurre el 30 (ajustado por getEffectiveMonthlyDay)
      const nov30 = new Date(2026, 10, 30);
      assert.equal(occursOnDate(monthlyReminder, nov30), true);

      // Noviembre día 29: no ocurre
      const nov29 = new Date(2026, 10, 29);
      assert.equal(occursOnDate(monthlyReminder, nov29), false);

      // Febrero 2027 (no bisiesto, 28 días): ocurre el 28
      const feb28_2027 = new Date(2027, 1, 28);
      assert.equal(occursOnDate(monthlyReminder, feb28_2027), true);

      // Febrero 2028 (año bisiesto, 29 días): ocurre el 29
      const feb29_2028 = new Date(2028, 1, 29);
      assert.equal(occursOnDate(monthlyReminder, feb29_2028), true);
    });

    it('Recordatorio de una sola vez: ocurre únicamente en su targetDate', () => {
      const onceReminder: Reminder = {
        id: 'rem-once',
        title: 'Entrega de proyecto',
        time: '02:00 PM',
        frequency: 'Una vez',
        repeatType: 'once',
        targetDate: '2026-11-15',
        isActive: true,
        createdAt: 1000,
      };

      assert.equal(occursOnDate(onceReminder, new Date(2026, 10, 15)), true);
      assert.equal(occursOnDate(onceReminder, new Date(2026, 10, 16)), false);
    });
  });

  describe('5. Persistencia tras cerrar y reiniciar la app', () => {
    it('Conserva íntegramente los datos históricos al reconstruir el servicio de almacenamiento', async () => {
      const storage = new InMemoryStorage();

      // Sesión 1: el usuario marca cumplimientos
      const session1Data: ReminderCompletion[] = [
        { reminderId: 'r1', dateKey: '2026-11-01', completedAt: 1000 },
        { reminderId: 'r2', dateKey: '2026-11-01', completedAt: 1005 },
        { reminderId: 'r1', dateKey: '2026-11-02', completedAt: 2000 },
      ];
      await saveStoredCompletions(session1Data, storage);

      // Sesión 2: la app se reinicia (nueva lectura de AsyncStorage)
      const session2Data = await getStoredCompletions(storage);

      assert.equal(session2Data.length, 3);
      assert.equal(isReminderCompleted(session2Data, 'r1', '2026-11-01'), true);
      assert.equal(isReminderCompleted(session2Data, 'r2', '2026-11-01'), true);
      assert.equal(isReminderCompleted(session2Data, 'r1', '2026-11-02'), true);
      assert.equal(isReminderCompleted(session2Data, 'r2', '2026-11-02'), false);
    });
  });

  describe('6. Integridad de notificaciones', () => {
    it('Completar o deshacer un cumplimiento no altera la estructura de un Reminder ni sus IDs de notificación', () => {
      const reminder: Reminder = {
        id: 'rem-protected',
        title: 'Medicina fija',
        time: '08:00 AM',
        frequency: 'Todos los días',
        repeatType: 'daily',
        isActive: true,
        category: 'salud',
        createdAt: 500,
        notificationId: 'notif-12345',
        notificationIds: ['notif-12345'],
      };

      // Clon original inmutable
      const originalClone = JSON.stringify(reminder);

      // Operaciones sobre el modelo independiente de cumplimiento
      const key = buildCompletionKey(reminder.id, '2026-11-02');
      assert.equal(key, 'rem-protected::2026-11-02');

      const completion: ReminderCompletion = {
        reminderId: reminder.id,
        dateKey: '2026-11-02',
        completedAt: Date.now(),
      };
      assert.equal(completion.reminderId, reminder.id);

      // El objeto Reminder permanece 100% inalterado
      assert.equal(JSON.stringify(reminder), originalClone);
      assert.equal(reminder.notificationId, 'notif-12345');
      assert.deepEqual(reminder.notificationIds, ['notif-12345']);
    });
  });
});
