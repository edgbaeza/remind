export type ReminderCategory = 'salud' | 'hogar' | 'finanzas' | 'personal' | 'general';

export interface Reminder {
  id: string;
  title: string;
  time: string;
  frequency: string;
  isActive: boolean;
  category?: ReminderCategory;
  days?: string[];
  createdAt: number;
}
