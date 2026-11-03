/**
 * Modelo de datos para el cumplimiento de ocurrencias de recordatorios.
 * Representa la realización de un recordatorio en una fecha local específica (YYYY-MM-DD).
 */
export interface ReminderCompletion {
  reminderId: string;
  dateKey: string; // Formato "YYYY-MM-DD" local
  completedAt: number; // Timestamp Unix en milisegundos
}

/**
 * Estructura versionada para el almacenamiento persistente en AsyncStorage.
 */
export interface StoredCompletionsPayload {
  version: number;
  completions: ReminderCompletion[];
}
