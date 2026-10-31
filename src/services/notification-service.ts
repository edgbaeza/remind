import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';

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
