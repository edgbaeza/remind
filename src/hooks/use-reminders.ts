import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import {
  type RemindersContextValue,
  useRemindersContext,
} from '@/context/reminders-context-core';
import {
  cancelReminderNotifications,
  reconcileScheduledNotifications,
  scheduleReminderNotification,
} from '@/services/notification-service';
import {
  AsyncQueue,
  getStoredReminders,
  saveStoredReminders,
} from '@/services/reminder-storage';
import {
  getStoredCompletions,
  isReminderCompleted,
  saveStoredCompletions,
} from '@/services/completion-storage';
import { ReminderCompletion } from '@/types/completion';
import { Reminder } from '@/types/reminder';
import { getLocalDateString, occursOnDate } from '@/utils/reminder-dates';

export type { RemindersContextValue };

/**
 * Hook controlador interno que gestiona la única instancia del estado de recordatorios,
 * la carga inicial, la reconciliación de notificaciones y la cola secuencial de persistencia.
 * Solo debe ser invocado por RemindersProvider.
 */
export function useRemindersController(): RemindersContextValue {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [completions, setCompletions] = useState<ReminderCompletion[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Referencia mutable al estado más reciente para evitar cierres obsoletos (stale closures)
  const remindersRef = useRef<Reminder[]>([]);
  const completionsRef = useRef<ReminderCompletion[]>([]);
  // Cola secuencial FIFO para serializar todas las operaciones asíncronas de recordatorios
  const queueRef = useRef<AsyncQueue>(new AsyncQueue());
  // Cola secuencial FIFO para serializar operaciones asíncronas de cumplimientos
  const completionQueueRef = useRef<AsyncQueue>(new AsyncQueue());
  const isMountedRef = useRef<boolean>(true);

  // Carga inicial y reconciliación de notificaciones con recordatorios persistidos y cumplimientos
  useEffect(() => {
    isMountedRef.current = true;

    async function loadData() {
      try {
        const [loadedReminders, loadedCompletions] = await Promise.all([
          getStoredReminders(),
          getStoredCompletions(),
        ]);

        const reconciledReminders = await reconcileScheduledNotifications(loadedReminders);

        // Guardar si hubo cambios en los IDs tras la reconciliación
        const hasChanges = JSON.stringify(loadedReminders) !== JSON.stringify(reconciledReminders);
        if (hasChanges) {
          await saveStoredReminders(reconciledReminders);
        }

        if (isMountedRef.current) {
          remindersRef.current = reconciledReminders;
          setReminders(reconciledReminders);
          completionsRef.current = loadedCompletions;
          setCompletions(loadedCompletions);
        }
      } catch (err) {
        console.error('[useReminders] Error durante la carga inicial:', err);
        if (isMountedRef.current) {
          Alert.alert(
            'Error de almacenamiento',
            'No fue posible leer los datos guardados. Por seguridad, no se han alterado tus notificaciones programadas.'
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addReminder = useCallback(
    async (newReminderData: Omit<Reminder, 'id' | 'createdAt'>) => {
      if (isLoading) return;

      await queueRef.current.enqueue(async () => {
        const currentList = remindersRef.current;
        const tempReminder: Reminder = {
          ...newReminderData,
          id: Date.now().toString(),
          createdAt: Date.now(),
        };

        let notificationId: string | undefined;
        let notificationIds: string[] | undefined;
        let permissionDenied = false;

        const isSupported =
          tempReminder.isActive &&
          (tempReminder.repeatType === 'once' ||
            tempReminder.repeatType === 'daily' ||
            tempReminder.repeatType === 'weekly' ||
            tempReminder.repeatType === 'monthly');

        if (isSupported) {
          const scheduleRes = await scheduleReminderNotification(tempReminder);
          if (scheduleRes.success && scheduleRes.notificationIds && scheduleRes.notificationIds.length > 0) {
            notificationId = scheduleRes.notificationId;
            notificationIds = scheduleRes.notificationIds;
          } else if (scheduleRes.permissionDenied) {
            permissionDenied = true;
          }
        }

        const newReminder: Reminder = {
          ...tempReminder,
          notificationId,
          notificationIds,
        };

        const updated = [newReminder, ...currentList];
        const saved = await saveStoredReminders(updated);

        if (!saved) {
          // Si falló la persistencia, revertir cualquier notificación creada para no dejar alertas huérfanas
          if (notificationIds && notificationIds.length > 0) {
            await cancelReminderNotifications(notificationIds);
          } else if (notificationId) {
            await cancelReminderNotifications(notificationId);
          }
          Alert.alert(
            'Error al guardar',
            'No se pudo guardar el recordatorio en el almacenamiento del dispositivo.'
          );
          return;
        }

        remindersRef.current = updated;
        if (isMountedRef.current) {
          setReminders(updated);
        }

        if (permissionDenied) {
          Alert.alert(
            'Recordatorio guardado sin notificación',
            'El recordatorio fue guardado, pero no podrá emitir alertas porque los permisos de notificación están desactivados en Android.',
            [{ text: 'Entendido' }]
          );
        }
      });
    },
    [isLoading]
  );

  const updateReminder = useCallback(
    async (id: string, updatedData: Partial<Omit<Reminder, 'id' | 'createdAt'>>) => {
      if (isLoading) return;

      await queueRef.current.enqueue(async () => {
        const currentList = remindersRef.current;
        const currentReminder = currentList.find((item) => item.id === id);
        if (!currentReminder) return;

        const mergedReminder: Reminder = {
          ...currentReminder,
          ...updatedData,
          id,
          createdAt: currentReminder.createdAt ?? Date.now(),
          notificationId: undefined,
          notificationIds: undefined,
        };

        let newNotificationId: string | undefined;
        let newNotificationIds: string[] | undefined;
        let permissionDenied = false;

        const isSupported =
          mergedReminder.isActive &&
          (mergedReminder.repeatType === 'once' ||
            mergedReminder.repeatType === 'daily' ||
            mergedReminder.repeatType === 'weekly' ||
            mergedReminder.repeatType === 'monthly');

        if (isSupported) {
          const scheduleRes = await scheduleReminderNotification(mergedReminder);
          if (scheduleRes.success && scheduleRes.notificationIds && scheduleRes.notificationIds.length > 0) {
            newNotificationId = scheduleRes.notificationId;
            newNotificationIds = scheduleRes.notificationIds;
          } else if (scheduleRes.permissionDenied) {
            permissionDenied = true;
          }
        }

        const finalUpdatedReminder: Reminder = {
          ...mergedReminder,
          notificationId: newNotificationId,
          notificationIds: newNotificationIds,
        };

        const updated = currentList.map((item) =>
          item.id === id ? finalUpdatedReminder : item
        );

        const saved = await saveStoredReminders(updated);

        if (!saved) {
          // Si falló el guardado, cancelar las notificaciones nuevas recién programadas
          if (newNotificationIds && newNotificationIds.length > 0) {
            await cancelReminderNotifications(newNotificationIds);
          } else if (newNotificationId) {
            await cancelReminderNotifications(newNotificationId);
          }
          Alert.alert(
            'Error al actualizar',
            'No fue posible guardar las modificaciones en el almacenamiento del dispositivo.'
          );
          return;
        }

        // Con el guardado confirmado, cancelar las notificaciones previas que fueron reemplazadas
        await cancelReminderNotifications(currentReminder);

        remindersRef.current = updated;
        if (isMountedRef.current) {
          setReminders(updated);
        }

        if (permissionDenied) {
          Alert.alert(
            'Cambios guardados sin notificación',
            'Se guardaron los cambios, pero las notificaciones están desactivadas en los Ajustes de Android.',
            [{ text: 'Entendido' }]
          );
        }
      });
    },
    [isLoading]
  );

  const toggleReminder = useCallback(
    async (id: string) => {
      if (isLoading) return;

      await queueRef.current.enqueue(async () => {
        const currentList = remindersRef.current;
        const currentReminder = currentList.find((item) => item.id === id);
        if (!currentReminder) return;

        const nextActive = !currentReminder.isActive;
        let nextNotificationId: string | undefined;
        let nextNotificationIds: string[] | undefined;
        let permissionDenied = false;

        if (nextActive) {
          // Al activar: programar si es soportada
          const isSupported =
            currentReminder.repeatType === 'once' ||
            currentReminder.repeatType === 'daily' ||
            currentReminder.repeatType === 'weekly' ||
            currentReminder.repeatType === 'monthly';

          if (isSupported) {
            const scheduleRes = await scheduleReminderNotification({
              ...currentReminder,
              isActive: true,
            });

            if (scheduleRes.success && scheduleRes.notificationIds && scheduleRes.notificationIds.length > 0) {
              nextNotificationId = scheduleRes.notificationId;
              nextNotificationIds = scheduleRes.notificationIds;
            } else if (scheduleRes.permissionDenied) {
              permissionDenied = true;
            }
          }
        }

        const updatedReminder: Reminder = {
          ...currentReminder,
          isActive: nextActive,
          notificationId: nextActive ? nextNotificationId : undefined,
          notificationIds: nextActive ? nextNotificationIds : undefined,
        };

        const updated = currentList.map((item) =>
          item.id === id ? updatedReminder : item
        );

        const saved = await saveStoredReminders(updated);

        if (!saved) {
          // Si falló el guardado, cancelar las notificaciones nuevas si se intentó activar
          if (nextActive) {
            if (nextNotificationIds && nextNotificationIds.length > 0) {
              await cancelReminderNotifications(nextNotificationIds);
            } else if (nextNotificationId) {
              await cancelReminderNotifications(nextNotificationId);
            }
          }
          Alert.alert(
            'Error al cambiar estado',
            'No fue posible actualizar el estado del recordatorio en el almacenamiento.'
          );
          return;
        }

        // Si se desactivó exitosamente, cancelar las notificaciones que estaban activas
        if (!nextActive) {
          await cancelReminderNotifications(currentReminder);
        }

        remindersRef.current = updated;
        if (isMountedRef.current) {
          setReminders(updated);
        }

        if (permissionDenied) {
          Alert.alert(
            'Permiso de notificaciones requerido',
            'Para recibir avisos de este recordatorio, concede el permiso de notificaciones a Remind en Ajustes.',
            [{ text: 'Entendido' }]
          );
        }
      });
    },
    [isLoading]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (isLoading) return;

      await queueRef.current.enqueue(async () => {
        const currentList = remindersRef.current;
        const currentReminder = currentList.find((item) => item.id === id);
        if (!currentReminder) return;

        const updated = currentList.filter((item) => item.id !== id);
        const saved = await saveStoredReminders(updated);

        if (!saved) {
          Alert.alert(
            'Error al eliminar',
            'No se pudo eliminar el recordatorio del almacenamiento del dispositivo.'
          );
          return;
        }

        // Cancelar notificaciones solo tras confirmar la persistencia
        await cancelReminderNotifications(currentReminder);

        remindersRef.current = updated;
        if (isMountedRef.current) {
          setReminders(updated);
        }
      });
    },
    [isLoading]
  );

  const toggleCompletion = useCallback(
    async (reminderId: string, dateKey: string): Promise<boolean> => {
      if (isLoading) return false;

      return completionQueueRef.current.enqueue(async () => {
        const todayKey = getLocalDateString();

        // Regla: No permitir completar fechas futuras
        if (dateKey > todayKey) {
          return false;
        }

        // Regla: En esta primera versión, permitir completar o deshacer solamente las ocurrencias de hoy
        if (dateKey !== todayKey) {
          return false;
        }

        const reminder = remindersRef.current.find((item) => item.id === reminderId);
        if (!reminder) {
          return false;
        }

        const currentCompletions = completionsRef.current;
        const alreadyCompleted = isReminderCompleted(currentCompletions, reminderId, dateKey);

        // Regla: Los recordatorios pausados no pueden marcarse como nuevos cumplimientos
        if (!reminder.isActive && !alreadyCompleted) {
          Alert.alert(
            'Recordatorio pausado',
            'Para marcar este recordatorio como completado, actívalo primero.'
          );
          return false;
        }

        // Regla: Verificar que el recordatorio corresponda a la fecha solicitada
        if (!occursOnDate(reminder, new Date())) {
          return false;
        }

        let updatedCompletions: ReminderCompletion[];

        if (alreadyCompleted) {
          // Deshacer cumplimiento
          updatedCompletions = currentCompletions.filter(
            (c) => !(c.reminderId === reminderId && c.dateKey === dateKey)
          );
        } else {
          // Marcar como completado (máximo un cumplimiento por recordatorio y fecha)
          const newCompletion: ReminderCompletion = {
            reminderId,
            dateKey,
            completedAt: Date.now(),
          };
          updatedCompletions = [newCompletion, ...currentCompletions];
        }

        // Persistir primero antes de actualizar la UI
        const saved = await saveStoredCompletions(updatedCompletions);
        if (!saved) {
          Alert.alert(
            'Error al guardar',
            'No se pudo registrar el cumplimiento en el almacenamiento del dispositivo.'
          );
          return false;
        }

        completionsRef.current = updatedCompletions;
        if (isMountedRef.current) {
          setCompletions(updatedCompletions);
        }

        return true;
      });
    },
    [isLoading]
  );

  const isCompletedOnDate = useCallback(
    (reminderId: string, dateKey: string): boolean => {
      return isReminderCompleted(completions, reminderId, dateKey);
    },
    [completions]
  );

  return useMemo(
    () => ({
      reminders,
      isLoading,
      addReminder,
      updateReminder,
      toggleReminder,
      deleteReminder,
      completions,
      toggleCompletion,
      isCompletedOnDate,
    }),
    [
      reminders,
      isLoading,
      addReminder,
      updateReminder,
      toggleReminder,
      deleteReminder,
      completions,
      toggleCompletion,
      isCompletedOnDate,
    ]
  );
}

/**
 * Interfaz pública para consumir el estado compartido de recordatorios desde cualquier pantalla.
 */
export function useReminders(): RemindersContextValue {
  return useRemindersContext();
}
