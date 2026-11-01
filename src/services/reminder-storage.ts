import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Reminder, RepeatType } from '../types/reminder.ts';

export const STORAGE_KEY = '@remind_app/reminders_v1';
export const INITIALIZED_KEY = '@remind_app/has_initialized_v1';

export class StorageReadError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageReadError';
    this.cause = cause;
  }
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

/**
 * Cola asíncrona secuencial (FIFO) para evitar condiciones de carrera,
 * ejecuciones concurrentes y escrituras fuera de orden.
 */
export class AsyncQueue {
  private queue: Promise<unknown> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const runTask = () => task();
    const resultPromise = this.queue.then(runTask, runTask);
    // Asegurar que la cola continúe procesando tareas incluso si una falla
    this.queue = resultPromise.then(
      () => {},
      () => {}
    );
    return resultPromise;
  }
}

export const INITIAL_REMINDERS: Reminder[] = [
  {
    id: '1',
    title: 'Tomar medicamento',
    time: '08:00 AM',
    frequency: 'Todos los días',
    repeatType: 'daily',
    isActive: true,
    category: 'salud',
    days: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
    createdAt: 1,
  },
  {
    id: '2',
    title: 'Regar las plantas',
    time: '06:00 PM',
    frequency: 'Mar, Jue',
    repeatType: 'weekly',
    isActive: true,
    category: 'hogar',
    days: ['M', 'J'],
    createdAt: 2,
  },
  {
    id: '3',
    title: 'Pagar internet',
    time: '09:00 AM',
    frequency: 'Cada día 15 del mes',
    repeatType: 'monthly',
    dayOfMonth: 15,
    isActive: true,
    category: 'finanzas',
    createdAt: 3,
  },
];

/**
 * Normaliza y migra un recordatorio existente para asegurar compatibilidad
 * hacia atrás con versiones anteriores de Remind.
 */
export function migrateReminder(raw: Reminder): Reminder {
  let migrated: Reminder;

  if (raw.repeatType) {
    migrated = raw;
  } else {
    const freq = (raw.frequency || '').toLowerCase();
    let repeatType: RepeatType = 'daily';
    let dayOfMonth: number | undefined;
    let targetDate: string | undefined;
    let days = raw.days;

    if (freq.includes('mes') || freq.includes('15') || freq.includes('mensual')) {
      repeatType = 'monthly';
      const match = raw.frequency.match(/\d+/);
      dayOfMonth = match ? parseInt(match[0], 10) : 15;
    } else if (
      days &&
      days.length > 0 &&
      days.length < 7
    ) {
      repeatType = 'weekly';
    } else if (
      freq.includes('martes') ||
      freq.includes('jueves') ||
      freq.includes('lunes') ||
      freq.includes('semanal') ||
      freq.includes('mar, jue')
    ) {
      repeatType = 'weekly';
      if (!days || days.length === 0) {
        if (freq.includes('martes') || freq.includes('jueves')) {
          days = ['M', 'J'];
        } else {
          days = ['L', 'M', 'X', 'J', 'V'];
        }
      }
    } else if (freq.includes('una sola vez') || freq.includes('única')) {
      repeatType = 'once';
      targetDate = new Date().toISOString().split('T')[0];
    } else {
      repeatType = 'daily';
    }

    migrated = {
      ...raw,
      repeatType,
      dayOfMonth,
      targetDate,
      days,
    };
  }

  // Normalizar la etiqueta de frecuencia para recordatorios semanales (remover prefijo legado "Cada ")
  if (migrated.repeatType === 'weekly' && migrated.frequency && /^Cada\s+/i.test(migrated.frequency)) {
    migrated = {
      ...migrated,
      frequency: migrated.frequency.replace(/^Cada\s+/i, ''),
    };
  }

  return migrated;
}

/**
 * Carga los recordatorios desde el almacenamiento local.
 * - Distingue entre una primera ejecución y una lista vaciada intencionalmente.
 * - Si es la primera vez que se abre la app, almacena y retorna los recordatorios de ejemplo.
 * - Si ya se ha inicializado previamente, retorna los datos guardados aplicando migración transparente.
 * - Lanza StorageReadError ante errores de I/O o datos corruptos para no confundir un error con una lista vacía.
 */
export async function getStoredReminders(
  storage: StorageAdapter = AsyncStorage
): Promise<Reminder[]> {
  try {
    const [rawReminders, hasInitialized] = await Promise.all([
      storage.getItem(STORAGE_KEY),
      storage.getItem(INITIALIZED_KEY),
    ]);

    // Caso 1: Primera ejecución de la app (nunca antes inicializada)
    if (hasInitialized === null && rawReminders === null) {
      await saveStoredReminders(INITIAL_REMINDERS, storage);
      await storage.setItem(INITIALIZED_KEY, 'true');
      return INITIAL_REMINDERS;
    }

    // Caso 2: App ya inicializada, hay datos guardados
    if (rawReminders !== null) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawReminders);
      } catch (parseError) {
        throw new StorageReadError(
          'Error al parsear el contenido de recordatorios almacenados.',
          parseError
        );
      }

      if (Array.isArray(parsed)) {
        return parsed.map(migrateReminder);
      }

      throw new StorageReadError(
        'El formato de recordatorios almacenados no es un arreglo válido.'
      );
    }

    // Caso 3: App ya inicializada pero la lista está vacía (legítimamente vacía)
    return [];
  } catch (error) {
    if (error instanceof StorageReadError) {
      throw error;
    }
    console.error('[ReminderStorage] Error al leer recordatorios de AsyncStorage:', error);
    throw new StorageReadError('Error al leer recordatorios de AsyncStorage.', error);
  }
}

/**
 * Guarda la lista de recordatorios en el almacenamiento local.
 */
export async function saveStoredReminders(
  reminders: Reminder[],
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    await storage.setItem(INITIALIZED_KEY, 'true');
    return true;
  } catch (error) {
    console.error('[ReminderStorage] Error al guardar recordatorios en AsyncStorage:', error);
    return false;
  }
}
