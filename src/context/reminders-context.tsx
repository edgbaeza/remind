import React from 'react';

import {
  RemindersContext,
  RemindersContextProvider,
  type RemindersContextValue,
  useRemindersContext,
} from '@/context/reminders-context-core';
import { useRemindersController } from '@/hooks/use-reminders';

export {
  RemindersContext,
  RemindersContextProvider,
  type RemindersContextValue,
  useRemindersContext,
};

/**
 * Proveedor compartido de recordatorios.
 * Mantiene una única instancia del estado, cola secuencial y reconciliación de notificaciones
 * para todas las pantallas de la aplicación (Inicio, Calendario, etc.).
 */
export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const controller = useRemindersController();

  return (
    <RemindersContextProvider value={controller}>
      {children}
    </RemindersContextProvider>
  );
}

export const useReminders = useRemindersContext;
