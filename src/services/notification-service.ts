import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  AndroidImportance,
  AndroidNotificationVisibility,
  SchedulableTriggerInputTypes,
} from 'expo-notifications';

import type { Reminder } from '../types/reminder.ts';
import { parseTimeString } from '../utils/reminder-dates.ts';
import {
  ANDROID_CHANNEL_ID,
  ANDROID_CHANNEL_NAME,
  cancelReminderNotificationsCore,
  getReminderNotificationIds,
  MONTH_NAMES_SPANISH,
  NotificationAdapter,
  NotificationContentData,
  reconcileScheduledNotificationsCore,
  scheduleReminderNotificationCore,
  ScheduleReminderResult,
} from './notification-core.ts';

export {
  ANDROID_CHANNEL_ID,
  ANDROID_CHANNEL_NAME,
  getReminderNotificationIds,
  MONTH_NAMES_SPANISH,
  NotificationAdapter,
  ScheduleReminderResult,
};

/**
 * Adaptador que conecta las operaciones del motor de recordatorios
 * con la API nativa de expo-notifications.
 */
export const defaultExpoAdapter: NotificationAdapter = {
  scheduleNotification: async (request) => {
    return await Notifications.scheduleNotificationAsync(
      request as Notifications.NotificationRequestInput
    );
  },
  cancelNotification: async (identifier) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      return true;
    } catch {
      return false;
    }
  },
  getAllScheduled: async () => {
    const list = await Notifications.getAllScheduledNotificationsAsync();
    return list.map((item) => ({
      identifier: item.identifier,
      content: {
        title: item.content.title,
        body: item.content.body,
        data: item.content.data as NotificationContentData | undefined,
      },
      trigger: item.trigger,
    }));
  },
};

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
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
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
 */
export async function scheduleTestNotification(
  seconds: number = 60
): Promise<ScheduleTestResult> {
  try {
    await setupNotificationChannel();

    const perms = await requestNotificationPermissions();
    if (!perms.granted) {
      return {
        success: false,
        error: 'PERMISSION_DENIED',
        errorMessage:
          'Los permisos de notificación están desactivados. Para recibir alertas de Remind, habilita las notificaciones en Ajustes > Aplicaciones > Remind.',
      };
    }

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
        type: SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + seconds * 1000),
        channelId: ANDROID_CHANNEL_ID,
        delivery: 'alarmClock',
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

/**
 * Programa las notificaciones para un recordatorio real de Remind.
 * Comprueba permisos, canal y delega en el motor de programación con rollback.
 */
export async function scheduleReminderNotification(
  reminder: Reminder,
  adapter: NotificationAdapter = defaultExpoAdapter
): Promise<ScheduleReminderResult> {
  try {
    if (!reminder.isActive) {
      return {
        success: false,
        error: 'REMINDER_INACTIVE',
        errorMessage: 'El recordatorio no está activo.',
      };
    }

    await setupNotificationChannel();

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

    return await scheduleReminderNotificationCore(reminder, adapter);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: 'SCHEDULE_FAILED',
      errorMessage: message,
    };
  }
}

/**
 * Consulta la próxima fecha de disparo de un trigger mensual nativo (1-28)
 * mediante getNextTriggerDateAsync de expo-notifications.
 */
export async function getNextMonthlyTriggerDate(
  dayOfMonth: number,
  timeStr: string
): Promise<Date | null> {
  try {
    const parsedTime = parseTimeString(timeStr);
    const trigger: Notifications.MonthlyTriggerInput = {
      type: SchedulableTriggerInputTypes.MONTHLY,
      day: Math.min(28, Math.max(1, dayOfMonth)),
      hour: parsedTime.getHours(),
      minute: parsedTime.getMinutes(),
      channelId: ANDROID_CHANNEL_ID,
      delivery: 'alarmClock',
    };
    const nextTimestamp = await Notifications.getNextTriggerDateAsync(trigger);
    return nextTimestamp ? new Date(nextTimestamp) : null;
  } catch (err) {
    console.warn('[getNextMonthlyTriggerDate] Error calculando próximo disparo:', err);
    return null;
  }
}

/**
 * Cancela todas las notificaciones asociadas a un recordatorio de forma segura.
 */
export async function cancelReminderNotifications(
  target?: Reminder | { notificationIds?: string[]; notificationId?: string } | string[] | string,
  adapter: NotificationAdapter = defaultExpoAdapter
): Promise<boolean> {
  return await cancelReminderNotificationsCore(target, adapter);
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
 * Sincroniza los recordatorios almacenados con las notificaciones actualmente programadas en el sistema.
 */
export async function reconcileScheduledNotifications(
  reminders: Reminder[],
  adapter: NotificationAdapter = defaultExpoAdapter
): Promise<Reminder[]> {
  return await reconcileScheduledNotificationsCore(reminders, adapter);
}

/**
 * Obtiene un resumen estructurado de las notificaciones actualmente programadas.
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
