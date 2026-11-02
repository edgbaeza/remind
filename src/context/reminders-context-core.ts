import React, { createContext, useContext } from 'react';

import type { Reminder } from '../types/reminder.ts';

export interface RemindersContextValue {
  reminders: Reminder[];
  isLoading: boolean;
  addReminder: (newReminderData: Omit<Reminder, 'id' | 'createdAt'>) => Promise<void>;
  updateReminder: (
    id: string,
    updatedData: Partial<Omit<Reminder, 'id' | 'createdAt'>>
  ) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
}

export const RemindersContext = createContext<RemindersContextValue | undefined>(undefined);

/**
 * Consume el contexto compartido de recordatorios.
 * Lanza un error descriptivo si se invoca fuera de RemindersProvider.
 */
export function useRemindersContext(): RemindersContextValue {
  const context = useContext(RemindersContext);
  if (!context) {
    throw new Error('useReminders debe ser utilizado dentro de un RemindersProvider.');
  }
  return context;
}

/**
 * Componente proveedor base que inyecta un valor de controlador en el árbol de React.
 */
export function RemindersContextProvider({
  value,
  children,
}: {
  value: RemindersContextValue;
  children: React.ReactNode;
}) {
  return React.createElement(RemindersContext.Provider, { value }, children);
}
