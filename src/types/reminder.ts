export type ReminderCategory = 'salud' | 'hogar' | 'finanzas' | 'personal' | 'general';

export type RepeatType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface Reminder {
  id: string;
  title: string;
  time: string;
  frequency: string;
  repeatType?: RepeatType;
  targetDate?: string; // Formato YYYY-MM-DD para recordatorios de una sola vez
  dayOfMonth?: number; // 1 - 31 para recordatorios mensuales
  days?: string[]; // Subconjunto de ['D', 'L', 'M', 'X', 'J', 'V', 'S'] para semanales
  isActive: boolean;
  category?: ReminderCategory;
  createdAt: number;
  notificationId?: string; // Identificador único (para compatibilidad con versiones previas)
  notificationIds?: string[]; // Identificadores de todas las notificaciones programadas (para semanal y unificado)
}
