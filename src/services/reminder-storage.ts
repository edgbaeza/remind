import AsyncStorage from '@react-native-async-storage/async-storage';

import { Reminder } from '@/types/reminder';

const STORAGE_KEY = '@remind_app/reminders_v1';
const INITIALIZED_KEY = '@remind_app/has_initialized_v1';

export const INITIAL_REMINDERS: Reminder[] = [
  {
    id: '1',
    title: 'Tomar medicamento',
    time: '8:00 AM',
    frequency: 'Diariamente',
    isActive: true,
    category: 'salud',
    createdAt: 1,
  },
  {
    id: '2',
    title: 'Regar las plantas',
    time: '6:00 PM',
    frequency: 'Martes y jueves',
    isActive: true,
    category: 'hogar',
    createdAt: 2,
  },
  {
    id: '3',
    title: 'Pagar internet',
    time: '9:00 AM',
    frequency: 'Día 15 de cada mes',
    isActive: true,
    category: 'finanzas',
    createdAt: 3,
  },
];

/**
 * Carga los recordatorios desde el almacenamiento local.
 * - Distingue entre una primera ejecución y una lista vaciada intencionalmente.
 * - Si es la primera vez que se abre la app, almacena y retorna los recordatorios de ejemplo.
 * - Si ya se ha inicializado previamente, retorna los datos guardados (incluso si es un arreglo vacío []).
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
        return parsed;
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

