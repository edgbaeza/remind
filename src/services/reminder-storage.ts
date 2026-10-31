import AsyncStorage from '@react-native-async-storage/async-storage';

import { Reminder, RepeatType } from '@/types/reminder';

const STORAGE_KEY = '@remind_app/reminders_v1';
const INITIALIZED_KEY = '@remind_app/has_initialized_v1';

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
    frequency: 'Cada Mar, Jue',
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
  if (raw.repeatType) {
    return raw;
  }

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

  return {
    ...raw,
    repeatType,
    dayOfMonth,
    targetDate,
    days,
  };
}

/**
 * Carga los recordatorios desde el almacenamiento local.
 * - Distingue entre una primera ejecución y una lista vaciada intencionalmente.
 * - Si es la primera vez que se abre la app, almacena y retorna los recordatorios de ejemplo.
 * - Si ya se ha inicializado previamente, retorna los datos guardados aplicando migración transparente.
 */
export async function getStoredReminders(): Promise<Reminder[]> {
  try {
    const [rawReminders, hasInitialized] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(INITIALIZED_KEY),
    ]);

    // Caso 1: Primera ejecución de la app (nunca antes inicializada)
    if (hasInitialized === null && rawReminders === null) {
      await saveStoredReminders(INITIAL_REMINDERS);
      await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
      return INITIAL_REMINDERS;
    }

    // Caso 2: App ya inicializada, hay datos guardados
    if (rawReminders !== null) {
      const parsed = JSON.parse(rawReminders);
      if (Array.isArray(parsed)) {
        return parsed.map(migrateReminder);
      }
    }

    // Caso 3: App ya inicializada pero la lista está vacía
    return [];
  } catch (error) {
    console.error('[ReminderStorage] Error al leer recordatorios de AsyncStorage:', error);
    return [];
  }
}

/**
 * Guarda la lista de recordatorios en el almacenamiento local.
 */
export async function saveStoredReminders(reminders: Reminder[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
    await AsyncStorage.setItem(INITIALIZED_KEY, 'true');
    return true;
  } catch (error) {
    console.error('[ReminderStorage] Error al guardar recordatorios en AsyncStorage:', error);
    return false;
  }
}
