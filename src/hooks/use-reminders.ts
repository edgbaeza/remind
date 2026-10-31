import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import {
  cancelReminderNotifications,
  reconcileScheduledNotifications,
  scheduleReminderNotification,
} from '@/services/notification-service';
import {
  getStoredReminders,
  saveStoredReminders,
} from '@/services/reminder-storage';
import { Reminder } from '@/types/reminder';

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carga inicial y reconciliación de notificaciones con recordatorios persistidos
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const loadedReminders = await getStoredReminders();
        const reconciledReminders = await reconcileScheduledNotifications(loadedReminders);

        // Guardar si hubo cambios en los IDs tras la reconciliación
        const hasChanges = JSON.stringify(loadedReminders) !== JSON.stringify(reconciledReminders);
        if (hasChanges) {
          await saveStoredReminders(reconciledReminders);
        }

        if (isMounted) {
          setReminders(reconciledReminders);
        }
      } catch (err) {
        console.error('[useReminders] Error durante la carga inicial:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const addReminder = useCallback(
    async (newReminderData: Omit<Reminder, 'id' | 'createdAt'>) => {
      if (isLoading) return;

      const tempReminder: Reminder = {
        ...newReminderData,
        id: Date.now().toString(),
        createdAt: Date.now(),
      };

      let notificationId: string | undefined;
      let notificationIds: string[] | undefined;

      const isSupported =
        tempReminder.isActive &&
        (tempReminder.repeatType === 'once' ||
          tempReminder.repeatType === 'daily' ||
          tempReminder.repeatType === 'weekly');

      if (isSupported) {
        const scheduleRes = await scheduleReminderNotification(tempReminder);
        if (scheduleRes.success && scheduleRes.notificationIds && scheduleRes.notificationIds.length > 0) {
          notificationId = scheduleRes.notificationId;
          notificationIds = scheduleRes.notificationIds;
        } else if (scheduleRes.permissionDenied) {
          Alert.alert(
            'Recordatorio guardado sin notificación',
            'El recordatorio fue guardado, pero no podrá emitir alertas porque los permisos de notificación están desactivados en Android.',
            [{ text: 'Entendido' }]
          );
        }
      }

      const newReminder: Reminder = {
        ...tempReminder,
        notificationId,
        notificationIds,
      };

      setReminders((prev) => {
        const updated = [newReminder, ...prev];
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading]
  );

  const updateReminder = useCallback(
    async (id: string, updatedData: Partial<Omit<Reminder, 'id' | 'createdAt'>>) => {
      if (isLoading) return;

      const currentReminder = reminders.find((item) => item.id === id);
      if (currentReminder) {
        await cancelReminderNotifications(currentReminder);
      }

      const mergedReminder: Reminder = {
        ...(currentReminder || {}),
        ...updatedData,
        id,
        createdAt: currentReminder?.createdAt ?? Date.now(),
        notificationId: undefined,
        notificationIds: undefined,
      } as Reminder;

      let newNotificationId: string | undefined;
      let newNotificationIds: string[] | undefined;

      const isSupported =
        mergedReminder.isActive &&
        (mergedReminder.repeatType === 'once' ||
          mergedReminder.repeatType === 'daily' ||
          mergedReminder.repeatType === 'weekly');

      if (isSupported) {
        const scheduleRes = await scheduleReminderNotification(mergedReminder);
        if (scheduleRes.success && scheduleRes.notificationIds && scheduleRes.notificationIds.length > 0) {
          newNotificationId = scheduleRes.notificationId;
          newNotificationIds = scheduleRes.notificationIds;
        } else if (scheduleRes.permissionDenied) {
          Alert.alert(
            'Cambios guardados sin notificación',
            'Se guardaron los cambios, pero las notificaciones están desactivadas en los Ajustes de Android.',
            [{ text: 'Entendido' }]
          );
        }
      }

      const finalUpdatedReminder: Reminder = {
        ...mergedReminder,
        notificationId: newNotificationId,
        notificationIds: newNotificationIds,
      };

      setReminders((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? finalUpdatedReminder : item
        );
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading, reminders]
  );

  const toggleReminder = useCallback(
    async (id: string) => {
      if (isLoading) return;

      const currentReminder = reminders.find((item) => item.id === id);
      if (!currentReminder) return;

      const nextActive = !currentReminder.isActive;
      let nextNotificationId: string | undefined;
      let nextNotificationIds: string[] | undefined;

      if (!nextActive) {
        // Al desactivar: cancelar todas las notificaciones existentes
        await cancelReminderNotifications(currentReminder);
        nextNotificationId = undefined;
        nextNotificationIds = undefined;
      } else {
        // Al activar: programar si es soportada
        const isSupported =
          currentReminder.repeatType === 'once' ||
          currentReminder.repeatType === 'daily' ||
          currentReminder.repeatType === 'weekly';

        if (isSupported) {
          const scheduleRes = await scheduleReminderNotification({
            ...currentReminder,
            isActive: true,
          });

          if (scheduleRes.success && scheduleRes.notificationIds && scheduleRes.notificationIds.length > 0) {
            nextNotificationId = scheduleRes.notificationId;
            nextNotificationIds = scheduleRes.notificationIds;
          } else if (scheduleRes.permissionDenied) {
            Alert.alert(
              'Permiso de notificaciones requerido',
              'Para recibir avisos de este recordatorio, concede el permiso de notificaciones a Remind en Ajustes.',
              [{ text: 'Entendido' }]
            );
          }
        }
      }

      setReminders((prev) => {
        const updated = prev.map((item) =>
          item.id === id
            ? {
                ...item,
                isActive: nextActive,
                notificationId: nextNotificationId,
                notificationIds: nextNotificationIds,
              }
            : item
        );
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading, reminders]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (isLoading) return;

      const currentReminder = reminders.find((item) => item.id === id);
      if (currentReminder) {
        await cancelReminderNotifications(currentReminder);
      }

      setReminders((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading, reminders]
  );

  return {
    reminders,
    isLoading,
    addReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
  };
}
