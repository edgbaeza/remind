import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';

import { Reminder } from '@/types/reminder';
import {
  DAY_KEY_TO_EXPO_WEEKDAY,
  getLocalDateString,
  parseLocalDateString,
  parseTimeString,
} from '@/utils/reminder-dates';

export const ANDROID_CHANNEL_ID = 'recordatorios';
export const ANDROID_CHANNEL_NAME = 'Recordatorios';

/**
 * Configuración del manejador de notificaciones en primer plano.
 * Permite que las notificaciones muestren un banner flotante,
 * emitan sonido y aparezcan en la lista de notificaciones aunque la app esté abierta.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Crea y configura el canal de notificación para Android con importancia alta,
 * vibración y color de luz distintivo.
 * No pasa 'sound' como parámetro para permitir que Android configure
 * sus AudioAttributes por defecto y evitar NullPointerException en el runtime nativo.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: ANDROID_CHANNEL_NAME,
        importance: AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    } catch (channelError) {
      console.warn('Advertencia al configurar el canal de notificaciones:', channelError);
    }
  }
}

/**
 * Consulta el estado actual de los permisos de notificación sin solicitar interacción al usuario.
 */
export async function checkNotificationPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
  return await Notifications.getPermissionsAsync();
}

/**
 * Solicita permisos de notificación al usuario si no han sido concedidos aún.
 * En Android 13+ (API 33+) muestra el cuadro nativo de permiso POST_NOTIFICATIONS.
 */
export async function requestNotificationPermissions(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.PermissionStatus;
}> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return {
      granted: true,
      canAskAgain: existing.canAskAgain,
      status: existing.status,
    };
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return {
    granted: requested.granted,
    canAskAgain: requested.canAskAgain,
    status: requested.status,
  };
}

export interface ScheduleTestResult {
  success: boolean;
  notificationId?: string;
  error?: 'PERMISSION_DENIED' | 'SCHEDULE_FAILED' | string;
  errorMessage?: string;
}

/**
 * Programa una notificación local de prueba para dentro de un número determinado de segundos
 * (por defecto 60 segundos).
 *
 * Configura previamente el canal de Android y verifica los permisos.
 */
export async function scheduleTestNotification(
  seconds: number = 60
): Promise<ScheduleTestResult> {
  try {
    // 1. Asegurar el canal de notificación en Android antes de pedir permisos
    await setupNotificationChannel();

    // 2. Comprobar/solicitar permisos
    const perms = await requestNotificationPermissions();
    if (!perms.granted) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        errorMessage:
          'Los permisos de notificación están desactivados. Para recibir alertas de Remind, habilita las notificaciones en Ajustes > Aplicaciones > Remind.',
      };
    }

    // 3. Programar la notificación local
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Recordatorio de prueba',
        body: '¡Las notificaciones de Remind funcionan!',
        data: {
          type: 'test_notification',
          scheduledAt: Date.now(),
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        channelId: ANDROID_CHANNEL_ID,
      },
    });

    return {
      success: true,
      notificationId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: 'SCHEDULE_FAILED',
      errorMessage: message,
    };
  }
}

export interface ScheduleReminderResult {
  success: boolean;
  notificationId?: string; // Primer identificador programado (compatibilidad)
  notificationIds?: string[]; // Todos los identificadores generados
  error?: 'PERMISSION_DENIED' | 'PAST_DATETIME' | 'NO_DAYS_SELECTED' | 'UNSUPPORTED_REPEAT_TYPE' | 'SCHEDULE_FAILED' | string;
  errorMessage?: string;
  permissionDenied?: boolean;
}

/**
 * Obtiene todos los IDs de notificación de un recordatorio,
 * unificando notificationIds y el notificationId clásico.
 */
export function getReminderNotificationIds(reminder: Reminder): string[] {
  if (reminder.notificationIds && Array.isArray(reminder.notificationIds) && reminder.notificationIds.length > 0) {
    return reminder.notificationIds.filter((id) => typeof id === 'string' && id.length > 0);
  }
  if (reminder.notificationId && typeof reminder.notificationId === 'string' && reminder.notificationId.length > 0) {
    return [reminder.notificationId];
  }
  return [];
}

/**
 * Programa la notificación para un recordatorio real de Remind.
 * Soporta recordatorios de tipo:
 * - 'once': una sola vez (trigger de fecha/hora exacta)
 * - 'daily': diario (trigger que se repite cada día a la hora fijada)
 * - 'weekly': semanal personalizado (un trigger por cada día seleccionado en days)
 */
export async function scheduleReminderNotification(
  reminder: Reminder
): Promise<ScheduleReminderResult> {
  try {
    if (!reminder.isActive) {
      return {
        success: false,
        error: 'REMINDER_INACTIVE',
        errorMessage: 'El recordatorio no está activo.',
      };
    }

    // 1. Asegurar el canal de notificación en Android
    await setupNotificationChannel();

    // 2. Comprobar permisos
    const perms = await requestNotificationPermissions();
    if (!perms.granted) {
      return {
        success: false,
        permissionDenied: true,
        error: 'PERMISSION_DENIED',
        errorMessage:
          'Los permisos de notificación están desactivados. El recordatorio se guardó sin alertas programadas.',
      };
    }

    // Caso 1: Una sola vez ('once')
    if (reminder.repeatType === 'once') {
      const dateStr = reminder.targetDate || getLocalDateString();
      const targetDate = parseLocalDateString(dateStr);
      const parsedTime = parseTimeString(reminder.time);
      targetDate.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);

      // Si la fecha y hora ya pasaron, no se programa notificación
      if (targetDate.getTime() <= Date.now()) {
        return {
          success: false,
          error: 'PAST_DATETIME',
          errorMessage: 'La fecha y hora del recordatorio ya han transcurrido.',
        };
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: `Recordatorio programado para las ${reminder.time}`,
          data: {
            reminderId: reminder.id,
            repeatType: reminder.repeatType,
          },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: ANDROID_CHANNEL_ID,
        },
      });

      return {
        success: true,
        notificationId,
        notificationIds: [notificationId],
      };
    }

    // Caso 2: Diario ('daily')
    if (reminder.repeatType === 'daily') {
      const parsedTime = parseTimeString(reminder.time);
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: `Recordatorio diario a las ${reminder.time}`,
          data: {
            reminderId: reminder.id,
            repeatType: reminder.repeatType,
          },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DAILY,
          hour: parsedTime.getHours(),
          minute: parsedTime.getMinutes(),
          channelId: ANDROID_CHANNEL_ID,
        },
      });

      return {
        success: true,
        notificationId,
        notificationIds: [notificationId],
      };
    }

    // Caso 3: Semanal personalizado ('weekly')
    if (reminder.repeatType === 'weekly') {
      const selectedDays = reminder.days || [];
      if (selectedDays.length === 0) {
        return {
          success: false,
          error: 'NO_DAYS_SELECTED',
          errorMessage: 'No se han seleccionado días de la semana para este recordatorio.',
        };
      }

      const parsedTime = parseTimeString(reminder.time);
      const hour = parsedTime.getHours();
      const minute = parsedTime.getMinutes();
      const scheduledIds: string[] = [];

      for (const dayKey of selectedDays) {
        const expoWeekday = DAY_KEY_TO_EXPO_WEEKDAY[dayKey];
        if (expoWeekday === undefined) {
          continue;
        }

        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: `Recordatorio semanal (${dayKey}) a las ${reminder.time}`,
            data: {
              reminderId: reminder.id,
              repeatType: 'weekly',
              dayKey,
              weekday: expoWeekday,
            },
          },
          trigger: {
            type: SchedulableTriggerInputTypes.WEEKLY,
            weekday: expoWeekday,
            hour,
            minute,
            channelId: ANDROID_CHANNEL_ID,
          },
        });

        scheduledIds.push(id);
      }

      if (scheduledIds.length === 0) {
        return {
          success: false,
          error: 'SCHEDULE_FAILED',
          errorMessage: 'No fue posible programar los días semanales seleccionados.',
        };
      }

      return {
        success: true,
        notificationId: scheduledIds[0],
        notificationIds: scheduledIds,
      };
    }

    // Caso 4: Mensual ('monthly') - reservado para la siguiente etapa
    return {
      success: false,
      error: 'UNSUPPORTED_REPEAT_TYPE',
      errorMessage: 'Esta frecuencia no está configurada para notificaciones en esta versión.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scheduleReminderNotification] Fallo al programar recordatorio ${reminder.id}:`, message);
    return {
      success: false,
      error: 'SCHEDULE_FAILED',
      errorMessage: message,
    };
  }
}

/**
 * Cancela todas las notificaciones asociadas a un recordatorio,
 * aceptando el recordatorio completo, una lista de IDs o un ID individual.
 */
export async function cancelReminderNotifications(
  target?: Reminder | { notificationIds?: string[]; notificationId?: string } | string[] | string
): Promise<boolean> {
  if (!target) {
    return false;
  }

  let idsToCancel: string[] = [];
  if (typeof target === 'string') {
    idsToCancel = [target];
  } else if (Array.isArray(target)) {
    idsToCancel = target.filter(Boolean);
  } else {
    idsToCancel = getReminderNotificationIds(target as Reminder);
  }

  if (idsToCancel.length === 0) {
    return false;
  }

  let anyCancelled = false;
  for (const id of idsToCancel) {
    const success = await cancelNotification(id);
    if (success) {
      anyCancelled = true;
    }
  }
  return anyCancelled;
}

/**
 * Cancela una notificación individual por ID (mantenido para compatibilidad).
 */
export async function cancelReminderNotification(notificationId?: string): Promise<boolean> {
  if (!notificationId) {
    return false;
  }
  return await cancelNotification(notificationId);
}

/**
 * Sincroniza los recordatorios almacenados con las notificaciones actualmente
 * programadas en el sistema. Asegura que los recordatorios activos tengan
 * todas sus notificaciones creadas y los inactivos no tengan alertas pendientes.
 */
export async function reconcileScheduledNotifications(reminders: Reminder[]): Promise<Reminder[]> {
  try {
    const scheduled = await getAllScheduledNotifications();
    const activeScheduledIds = new Set(scheduled.map((s) => s.identifier));

    const updatedReminders: Reminder[] = [];

    for (const reminder of reminders) {
      const isSupportedType =
        reminder.repeatType === 'once' ||
        reminder.repeatType === 'daily' ||
        reminder.repeatType === 'weekly';

      const currentIds = getReminderNotificationIds(reminder);

      if (reminder.isActive && isSupportedType) {
        let needsReschedule = false;

        if (reminder.repeatType === 'once' || reminder.repeatType === 'daily') {
          // Requiere exactamente 1 ID y que exista en el sistema
          if (currentIds.length !== 1 || !activeScheduledIds.has(currentIds[0])) {
            needsReschedule = true;
          }
        } else if (reminder.repeatType === 'weekly') {
          // Requiere tantos IDs como días seleccionados y que todos existan en el sistema
          const expectedDaysCount = reminder.days?.length ?? 0;
          if (expectedDaysCount === 0) {
            needsReschedule = false;
          } else if (
            currentIds.length !== expectedDaysCount ||
            !currentIds.every((id) => activeScheduledIds.has(id))
          ) {
            needsReschedule = true;
          }
        }

        if (needsReschedule) {
          // Cancelar IDs desactualizados o incompletos antes de reprogramar
          for (const id of currentIds) {
            if (activeScheduledIds.has(id)) {
              await cancelNotification(id);
            }
          }

          const res = await scheduleReminderNotification(reminder);
          if (res.success && res.notificationIds && res.notificationIds.length > 0) {
            updatedReminders.push({
              ...reminder,
              notificationId: res.notificationId,
              notificationIds: res.notificationIds,
            });
          } else {
            updatedReminders.push({
              ...reminder,
              notificationId: undefined,
              notificationIds: undefined,
            });
          }
        } else {
          // Todo está sincronizado
          updatedReminders.push(reminder);
        }
      } else {
        // Inactivo o no soportado: cancelar cualquier notificación residual
        if (currentIds.length > 0) {
          for (const id of currentIds) {
            if (activeScheduledIds.has(id)) {
              await cancelNotification(id);
            }
          }
          updatedReminders.push({
            ...reminder,
            notificationId: undefined,
            notificationIds: undefined,
          });
        } else {
          updatedReminders.push(reminder);
        }
      }
    }

    return updatedReminders;
  } catch (err) {
    console.warn('[reconcileScheduledNotifications] Error durante la reconciliación:', err);
    return reminders;
  }
}

/**
 * Obtiene un resumen estructurado de las notificaciones actualmente programadas.
 * Útil para depuración y verificación.
 */
export async function getScheduledNotificationsReport(): Promise<
  { id: string; title: string; trigger: unknown }[]
> {
  const all = await getAllScheduledNotifications();
  return all.map((req) => ({
    id: req.identifier,
    title: req.content.title ?? '(Sin título)',
    trigger: req.trigger,
  }));
}

/**
 * Suscribe un listener que se ejecuta cuando se recibe una notificación mientras la app está abierta.
 */
export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(listener);
}

/**
 * Cancela una notificación programada específica mediante su ID.
 */
export async function cancelNotification(notificationId: string): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return true;
  } catch (error) {
    console.warn('Error al cancelar la notificación:', error);
    return false;
  }
}

/**
 * Cancela todas las notificaciones programadas.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Obtiene la lista de todas las notificaciones que están actualmente programadas en el sistema.
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  return await Notifications.getAllScheduledNotificationsAsync();
}
