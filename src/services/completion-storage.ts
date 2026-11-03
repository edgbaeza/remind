import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ReminderCompletion, StoredCompletionsPayload } from '@/types/completion';

export const COMPLETIONS_STORAGE_KEY = '@remind_app/completions_v1';
export const COMPLETIONS_SCHEMA_VERSION = 1;

export class CompletionStorageReadError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'CompletionStorageReadError';
    this.cause = cause;
  }
}

export interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

/**
 * Genera una clave compuesta única para identificar una ocurrencia por recordatorio y fecha.
 */
export function buildCompletionKey(reminderId: string, dateKey: string): string {
  return `${reminderId}::${dateKey}`;
}

/**
 * Verifica si un recordatorio fue completado en una fecha dada dentro de una lista de cumplimientos.
 */
export function isReminderCompleted(
  completions: ReminderCompletion[],
  reminderId: string,
  dateKey: string
): boolean {
  return completions.some(
    (item) => item.reminderId === reminderId && item.dateKey === dateKey
  );
}

/**
 * Lee la lista histórica de cumplimientos desde el almacenamiento local.
 * Lanza CompletionStorageReadError ante errores de I/O o datos JSON corruptos
 * para no confundir un fallo de lectura con una lista vacía.
 */
export async function getStoredCompletions(
  storage: StorageAdapter = AsyncStorage
): Promise<ReminderCompletion[]> {
  try {
    const rawData = await storage.getItem(COMPLETIONS_STORAGE_KEY);

    // Caso 1: Almacenamiento no inicializado aún
    if (rawData === null) {
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch (parseError) {
      throw new CompletionStorageReadError(
        'Error al parsear el contenido de cumplimientos almacenados.',
        parseError
      );
    }

    // Caso 2: Estructura versionada esperada { version: 1, completions: [...] }
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'completions' in parsed &&
      Array.isArray((parsed as StoredCompletionsPayload).completions)
    ) {
      const payload = parsed as StoredCompletionsPayload;
      // Sanitizar y deduplicar en memoria por seguridad (máximo 1 cumplimiento por reminderId y dateKey)
      const seen = new Set<string>();
      const sanitized: ReminderCompletion[] = [];

      for (const item of payload.completions) {
        if (item && typeof item.reminderId === 'string' && typeof item.dateKey === 'string') {
          const key = buildCompletionKey(item.reminderId, item.dateKey);
          if (!seen.has(key)) {
            seen.add(key);
            sanitized.push({
              reminderId: item.reminderId,
              dateKey: item.dateKey,
              completedAt: typeof item.completedAt === 'number' ? item.completedAt : Date.now(),
            });
          }
        }
      }

      return sanitized;
    }

    // Caso 3: Si se almacenó un arreglo crudo directamente (compatibilidad defensiva)
    if (Array.isArray(parsed)) {
      const seen = new Set<string>();
      const sanitized: ReminderCompletion[] = [];
      for (const item of parsed) {
        if (item && typeof item.reminderId === 'string' && typeof item.dateKey === 'string') {
          const key = buildCompletionKey(item.reminderId, item.dateKey);
          if (!seen.has(key)) {
            seen.add(key);
            sanitized.push({
              reminderId: item.reminderId,
              dateKey: item.dateKey,
              completedAt: typeof item.completedAt === 'number' ? item.completedAt : Date.now(),
            });
          }
        }
      }
      return sanitized;
    }

    throw new CompletionStorageReadError(
      'El formato de datos de cumplimientos almacenados no es válido.'
    );
  } catch (error) {
    if (error instanceof CompletionStorageReadError) {
      throw error;
    }
    console.error('[CompletionStorage] Error al leer cumplimientos de AsyncStorage:', error);
    throw new CompletionStorageReadError('Error al leer cumplimientos de AsyncStorage.', error);
  }
}

/**
 * Guarda la lista de cumplimientos en el almacenamiento local con formato versionado.
 */
export async function saveStoredCompletions(
  completions: ReminderCompletion[],
  storage: StorageAdapter = AsyncStorage
): Promise<boolean> {
  try {
    const payload: StoredCompletionsPayload = {
      version: COMPLETIONS_SCHEMA_VERSION,
      completions,
    };
    await storage.setItem(COMPLETIONS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('[CompletionStorage] Error al guardar cumplimientos en AsyncStorage:', error);
    return false;
  }
}
