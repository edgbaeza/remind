import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AsyncQueue,
  getStoredReminders,
  INITIAL_REMINDERS,
  INITIALIZED_KEY,
  saveStoredReminders,
  STORAGE_KEY,
  StorageReadError,
} from '../services/reminder-storage.ts';
import type { StorageAdapter } from '../services/reminder-storage.ts';
import type { Reminder } from '../types/reminder.ts';

class InMemoryStorage implements StorageAdapter {
  public store = new Map<string, string>();
  public shouldFailGet = false;
  public shouldFailSet = false;
  public getItemDelay = 0;
  public setItemDelay = 0;

  async getItem(key: string): Promise<string | null> {
    if (this.getItemDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.getItemDelay));
    }
    if (this.shouldFailGet) {
      throw new Error('Simulated AsyncStorage read failure');
    }
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.setItemDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.setItemDelay));
    }
    if (this.shouldFailSet) {
      throw new Error('Simulated AsyncStorage write failure');
    }
    this.store.set(key, value);
  }
}

describe('Pruebas unitarias de Persistencia (AsyncStorage y AsyncQueue)', () => {
  describe('1. Inicialización y lectura de recordatorios (getStoredReminders)', () => {
    it('Primera ejecución de la app: inicializa con INITIAL_REMINDERS y marca initialized', async () => {
      const storage = new InMemoryStorage();
      const reminders = await getStoredReminders(storage);

      assert.equal(reminders.length, INITIAL_REMINDERS.length);
      assert.equal(reminders[0].title, INITIAL_REMINDERS[0].title);
      assert.equal(storage.store.get(INITIALIZED_KEY), 'true');
      assert.ok(storage.store.has(STORAGE_KEY));
    });

    it('Lista legítimamente vacía (app inicializada, lista vaciada por el usuario): retorna []', async () => {
      const storage = new InMemoryStorage();
      storage.store.set(INITIALIZED_KEY, 'true');
      storage.store.set(STORAGE_KEY, JSON.stringify([]));

      const reminders = await getStoredReminders(storage);
      assert.deepEqual(reminders, []);
    });

    it('Fallo de I/O en AsyncStorage: lanza StorageReadError y NO retorna []', async () => {
      const storage = new InMemoryStorage();
      storage.shouldFailGet = true;

      await assert.rejects(
        async () => {
          await getStoredReminders(storage);
        },
        (err: unknown) => {
          assert.ok(err instanceof StorageReadError);
          assert.match(err.message, /Error al leer recordatorios/);
          return true;
        }
      );
    });

    it('JSON corrupto en almacenamiento: lanza StorageReadError en vez de retornar []', async () => {
      const storage = new InMemoryStorage();
      storage.store.set(INITIALIZED_KEY, 'true');
      storage.store.set(STORAGE_KEY, '{ json_invalido_sin_cerrar: ');

      await assert.rejects(
        async () => {
          await getStoredReminders(storage);
        },
        (err: unknown) => {
          assert.ok(err instanceof StorageReadError);
          assert.match(err.message, /Error al parsear/);
          return true;
        }
      );
    });

    it('Dato almacenado que no es arreglo: lanza StorageReadError', async () => {
      const storage = new InMemoryStorage();
      storage.store.set(INITIALIZED_KEY, 'true');
      storage.store.set(STORAGE_KEY, JSON.stringify({ noEsUnArreglo: true }));

      await assert.rejects(
        async () => {
          await getStoredReminders(storage);
        },
        (err: unknown) => {
          assert.ok(err instanceof StorageReadError);
          assert.match(err.message, /no es un arreglo válido/);
          return true;
        }
      );
    });
  });

  describe('2. Escritura de recordatorios (saveStoredReminders)', () => {
    it('Guarda exitosamente la lista y retorna true', async () => {
      const storage = new InMemoryStorage();
      const sampleList: Reminder[] = [
        {
          id: 'test-1',
          title: 'Prueba de guardado',
          time: '08:00 AM',
          frequency: 'Todos los días',
          repeatType: 'daily',
          isActive: true,
          createdAt: Date.now(),
        },
      ];

      const success = await saveStoredReminders(sampleList, storage);
      assert.equal(success, true);
      assert.equal(storage.store.get(INITIALIZED_KEY), 'true');

      const savedJson = storage.store.get(STORAGE_KEY);
      assert.ok(savedJson);
      const parsed = JSON.parse(savedJson!);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].id, 'test-1');
    });

    it('Fallo simulado de escritura: gestiona el error y retorna false sin lanzar excepción no controlada', async () => {
      const storage = new InMemoryStorage();
      storage.shouldFailSet = true;

      const success = await saveStoredReminders([], storage);
      assert.equal(success, false);
    });
  });

  describe('3. Cola asíncrona secuencial (AsyncQueue)', () => {
    it('Ejecuta operaciones consecutivas en orden estricto FIFO', async () => {
      const queue = new AsyncQueue();
      const executionOrder: number[] = [];

      const p1 = queue.enqueue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionOrder.push(1);
        return 1;
      });

      const p2 = queue.enqueue(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(2);
        return 2;
      });

      const p3 = queue.enqueue(async () => {
        executionOrder.push(3);
        return 3;
      });

      const results = await Promise.all([p1, p2, p3]);
      assert.deepEqual(results, [1, 2, 3]);
      assert.deepEqual(executionOrder, [1, 2, 3], 'Las tareas deben ejecutarse secuencialmente en orden 1 -> 2 -> 3');
    });

    it('Previene escrituras fuera de orden (operación lenta seguida de operación rápida)', async () => {
      const queue = new AsyncQueue();
      const storage = new InMemoryStorage();

      const reminderV1: Reminder = {
        id: '1',
        title: 'Versión 1 (Lenta)',
        time: '08:00 AM',
        frequency: 'Todos los días',
        repeatType: 'daily',
        isActive: true,
        createdAt: 1,
      };

      const reminderV2: Reminder = {
        id: '1',
        title: 'Versión 2 (Rápida - Estado más reciente)',
        time: '09:00 AM',
        frequency: 'Todos los días',
        repeatType: 'daily',
        isActive: true,
        createdAt: 2,
      };

      // Tarea 1: Escritura lenta (tarda 40ms)
      const op1 = queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 40));
        await saveStoredReminders([reminderV1], storage);
      });

      // Tarea 2: Escritura rápida (tarda 5ms) encolada inmediatamente después
      const op2 = queue.enqueue(async () => {
        await new Promise((r) => setTimeout(r, 5));
        await saveStoredReminders([reminderV2], storage);
      });

      await Promise.all([op1, op2]);

      // Comprobar que en el almacenamiento quedó Versión 2 y no fue sobrescrita por Versión 1
      const savedRaw = storage.store.get(STORAGE_KEY);
      assert.ok(savedRaw);
      const parsed = JSON.parse(savedRaw!);
      assert.equal(parsed[0].title, 'Versión 2 (Rápida - Estado más reciente)');
    });

    it('Recuperación ante fallos: una tarea fallida no bloquea las siguientes en la cola', async () => {
      const queue = new AsyncQueue();
      const executionLog: string[] = [];

      const pFail = queue.enqueue(async () => {
        executionLog.push('intento-1-falla');
        throw new Error('Fallo simulado en tarea 1');
      });

      const pSuccess = queue.enqueue(async () => {
        executionLog.push('intento-2-exito');
        return 'recuperado';
      });

      await assert.rejects(async () => pFail, /Fallo simulado en tarea 1/);
      const res2 = await pSuccess;

      assert.equal(res2, 'recuperado');
      assert.deepEqual(executionLog, ['intento-1-falla', 'intento-2-exito']);
    });
  });
});
