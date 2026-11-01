import type { Reminder } from '../types/reminder.ts';
import {
  calculateMonthlyOccurrences,
  DAY_KEY_TO_EXPO_WEEKDAY,
  getLocalDateString,
  parseLocalDateString,
  parseTimeString,
} from '../utils/reminder-dates.ts';

export const ANDROID_CHANNEL_ID = 'recordatorios';
export const ANDROID_CHANNEL_NAME = 'Recordatorios';

export const MONTH_NAMES_SPANISH = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export interface NotificationContentData {
  reminderId?: string;
  repeatType?: string;
  time?: string;
  targetDate?: string;
  targetDateIso?: string;
  dayOfMonth?: number;
  dayKey?: string;
  weekday?: number;
  mode?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ScheduledNotificationItem {
  identifier: string;
  content: {
    title?: string | null;
    body?: string | null;
    data?: NotificationContentData;
  };
  trigger: unknown;
}

export interface NotificationAdapter {
  scheduleNotification: (request: {
    content: {
      title: string;
      body: string;
      data: NotificationContentData;
    };
    trigger: unknown;
  }) => Promise<string>;
  cancelNotification: (identifier: string) => Promise<boolean>;
  getAllScheduled: () => Promise<ScheduledNotificationItem[]>;
}

export interface ScheduleReminderResult {
  success: boolean;
  notificationId?: string;
  notificationIds?: string[];
  error?:
    | 'REMINDER_INACTIVE'
    | 'PERMISSION_DENIED'
    | 'PAST_DATETIME'
    | 'NO_DAYS_SELECTED'
    | 'UNSUPPORTED_REPEAT_TYPE'
    | 'SCHEDULE_FAILED'
    | string;
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
 * Cancela todas las notificaciones asociadas a un recordatorio de manera segura.
 * Retorna true ÚNICAMENTE si todas las cancelaciones fueron exitosas.
 */
export async function cancelReminderNotificationsCore(
  target: Reminder | { notificationIds?: string[]; notificationId?: string } | string[] | string | undefined,
  adapter: NotificationAdapter
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
    return true; // No hay notificaciones pendientes por cancelar
  }

  let allSucceeded = true;
  for (const id of idsToCancel) {
    try {
      const success = await adapter.cancelNotification(id);
      if (!success) {
        allSucceeded = false;
      }
    } catch {
      allSucceeded = false;
    }
  }

  return allSucceeded;
}

/**
 * Programa las notificaciones de un recordatorio con recuperación y rollback ante fallos parciales.
 */
export async function scheduleReminderNotificationCore(
  reminder: Reminder,
  adapter: NotificationAdapter
): Promise<ScheduleReminderResult> {
  try {
    if (!reminder.isActive) {
      return {
        success: false,
        error: 'REMINDER_INACTIVE',
        errorMessage: 'El recordatorio no está activo.',
      };
    }

    // Caso 1: Una sola vez ('once')
    if (reminder.repeatType === 'once') {
      const dateStr = reminder.targetDate || getLocalDateString();
      const targetDate = parseLocalDateString(dateStr);
      const parsedTime = parseTimeString(reminder.time);
      targetDate.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);

      if (targetDate.getTime() <= Date.now()) {
        return {
          success: false,
          error: 'PAST_DATETIME',
          errorMessage: 'La fecha y hora del recordatorio ya han transcurrido.',
        };
      }

      const notificationId = await adapter.scheduleNotification({
        content: {
          title: reminder.title,
          body: `Recordatorio programado para las ${reminder.time}`,
          data: {
            reminderId: reminder.id,
            repeatType: 'once',
            time: reminder.time,
            targetDate: dateStr,
          },
        },
        trigger: {
          type: 'date',
          date: targetDate,
          channelId: ANDROID_CHANNEL_ID,
          delivery: 'alarmClock',
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
      const notificationId = await adapter.scheduleNotification({
        content: {
          title: reminder.title,
          body: `Recordatorio diario a las ${reminder.time}`,
          data: {
            reminderId: reminder.id,
            repeatType: 'daily',
            time: reminder.time,
          },
        },
        trigger: {
          type: 'daily',
          hour: parsedTime.getHours(),
          minute: parsedTime.getMinutes(),
          channelId: ANDROID_CHANNEL_ID,
          delivery: 'alarmClock',
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

      try {
        for (const dayKey of selectedDays) {
          const expoWeekday = DAY_KEY_TO_EXPO_WEEKDAY[dayKey];
          if (expoWeekday === undefined) {
            continue;
          }

          const id = await adapter.scheduleNotification({
            content: {
              title: reminder.title,
              body: `Recordatorio semanal (${dayKey}) a las ${reminder.time}`,
              data: {
                reminderId: reminder.id,
                repeatType: 'weekly',
                time: reminder.time,
                dayKey,
                weekday: expoWeekday,
              },
            },
            trigger: {
              type: 'weekly',
              weekday: expoWeekday,
              hour,
              minute,
              channelId: ANDROID_CHANNEL_ID,
              delivery: 'alarmClock',
            },
          });

          scheduledIds.push(id);
        }
      } catch (scheduleErr) {
        // Rollback automático: si falla a mitad del proceso, cancelar todas las notificaciones ya creadas
        for (const id of scheduledIds) {
          try {
            await adapter.cancelNotification(id);
          } catch {
            // Continuar cancelando las demás
          }
        }
        throw scheduleErr;
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

    // Caso 4: Mensual ('monthly')
    if (reminder.repeatType === 'monthly') {
      const dayOfMonth = Math.min(31, Math.max(1, reminder.dayOfMonth ?? 15));
      const parsedTime = parseTimeString(reminder.time);
      const hour = parsedTime.getHours();
      const minute = parsedTime.getMinutes();

      // Subcaso 4A: Días fijos (1 al 28) - Activador MONTHLY nativo
      if (dayOfMonth <= 28) {
        const notificationId = await adapter.scheduleNotification({
          content: {
            title: reminder.title,
            body: `Recordatorio mensual (día ${dayOfMonth}) a las ${reminder.time}`,
            data: {
              reminderId: reminder.id,
              repeatType: 'monthly',
              time: reminder.time,
              dayOfMonth,
              mode: 'native_monthly',
            },
          },
          trigger: {
            type: 'monthly',
            day: dayOfMonth,
            hour,
            minute,
            channelId: ANDROID_CHANNEL_ID,
            delivery: 'alarmClock',
          },
        });

        return {
          success: true,
          notificationId,
          notificationIds: [notificationId],
        };
      }

      // Subcaso 4B: Días variables (29, 30 y 31) - Horizonte calculado de 24 meses
      const occurrences = calculateMonthlyOccurrences(dayOfMonth, reminder.time, 24);
      if (occurrences.length === 0) {
        return {
          success: false,
          error: 'PAST_DATETIME',
          errorMessage: 'No se encontraron ocurrencias futuras para este recordatorio mensual.',
        };
      }

      const scheduledIds: string[] = [];

      try {
        for (const occurrence of occurrences) {
          // Usar getLocalDateString para evitar sesgos UTC
          const dateIso = getLocalDateString(occurrence);
          const notificationId = await adapter.scheduleNotification({
            content: {
              title: reminder.title,
              body: `Recordatorio mensual (${occurrence.getDate()} de ${MONTH_NAMES_SPANISH[occurrence.getMonth()]}) a las ${reminder.time}`,
              data: {
                reminderId: reminder.id,
                repeatType: 'monthly',
                time: reminder.time,
                dayOfMonth,
                targetDateIso: dateIso,
                mode: 'calculated_date_horizon',
              },
            },
            trigger: {
              type: 'date',
              date: occurrence,
              channelId: ANDROID_CHANNEL_ID,
              delivery: 'alarmClock',
            },
          });
          scheduledIds.push(notificationId);
        }
      } catch (horizonErr) {
        // Rollback automático: cancelar las notificaciones parciales creadas antes del fallo
        for (const id of scheduledIds) {
          try {
            await adapter.cancelNotification(id);
          } catch {
            // Continuar con las demás
          }
        }
        throw horizonErr;
      }

      return {
        success: scheduledIds.length > 0,
        notificationId: scheduledIds[0],
        notificationIds: scheduledIds,
      };
    }

    return {
      success: false,
      error: 'UNSUPPORTED_REPEAT_TYPE',
      errorMessage: 'Frecuencia no soportada.',
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
 * Sincroniza los recordatorios almacenados con las notificaciones actualmente programadas en el sistema.
 * - Detecta y limpia notificaciones huérfanas pertenecientes a Remind.
 * - Respeta y no cancela notificaciones de prueba ni de terceros.
 * - Evita duplicados para el mismo día o fecha.
 * - Detecta cambios en hora, día o frecuencia y renueva las notificaciones desactualizadas.
 * - Repone el horizonte de 24 meses usando exclusivamente fechas locales (getLocalDateString).
 */
export async function reconcileScheduledNotificationsCore(
  reminders: Reminder[],
  adapter: NotificationAdapter
): Promise<Reminder[]> {
  try {
    const scheduled = await adapter.getAllScheduled();
    const activeScheduledIds = new Set(scheduled.map((s) => s.identifier));

    // Identificar notificaciones que pertenecen al sistema de recordatorios de Remind
    // Regla estricta: NO tocar notificaciones de prueba (type === 'test_notification') ni ajenas
    const remindScheduled = scheduled.filter(
      (s) => typeof s.content.data?.reminderId === 'string'
    );

    const activeReminders = new Set(reminders.filter((r) => r.isActive).map((r) => r.id));

    // 1. Limpieza de notificaciones huérfanas pertenecientes a Remind
    // (recordatorios que fueron eliminados o desactivados)
    for (const notif of remindScheduled) {
      const rId = notif.content.data!.reminderId as string;
      if (!activeReminders.has(rId)) {
        await adapter.cancelNotification(notif.identifier);
        activeScheduledIds.delete(notif.identifier);
      }
    }

    // 2. Reconciliación de cada recordatorio
    const updatedReminders: Reminder[] = [];

    for (const reminder of reminders) {
      const isSupportedType =
        reminder.repeatType === 'once' ||
        reminder.repeatType === 'daily' ||
        reminder.repeatType === 'weekly' ||
        reminder.repeatType === 'monthly';

      const currentIds = getReminderNotificationIds(reminder);

      if (!reminder.isActive || !isSupportedType) {
        // Inactivo o no soportado: limpiar cualquier ID residual en el recordatorio
        if (currentIds.length > 0) {
          for (const id of currentIds) {
            if (activeScheduledIds.has(id)) {
              await adapter.cancelNotification(id);
              activeScheduledIds.delete(id);
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
        continue;
      }

      // Notificaciones activas en el sistema para este reminderId
      const notifsForThisReminder = scheduled.filter(
        (s) =>
          activeScheduledIds.has(s.identifier) &&
          (s.content.data?.reminderId === reminder.id || currentIds.includes(s.identifier))
      );

      // --- CASO MENSUAL HORIZONTE (DÍAS 29, 30 y 31) ---
      if (reminder.repeatType === 'monthly' && (reminder.dayOfMonth ?? 15) >= 29) {
        const dayOfMonth = reminder.dayOfMonth ?? 31;
        const targetOccurrences = calculateMonthlyOccurrences(dayOfMonth, reminder.time, 24);

        // Si la hora o el día del mes cambiaron, las notificaciones anteriores son obsoletas
        const isStale = notifsForThisReminder.some((n) => {
          const d = n.content.data;
          return (
            (d?.time && d.time !== reminder.time) ||
            (d?.dayOfMonth && d.dayOfMonth !== dayOfMonth)
          );
        });

        if (isStale) {
          for (const n of notifsForThisReminder) {
            await adapter.cancelNotification(n.identifier);
            activeScheduledIds.delete(n.identifier);
          }
          const res = await scheduleReminderNotificationCore(reminder, adapter);
          updatedReminders.push({
            ...reminder,
            notificationId: res.notificationId,
            notificationIds: res.notificationIds,
          });
          continue;
        }

        // Mapa de fecha local -> lista de IDs para deduplicar
        const scheduledByDate = new Map<string, string[]>();
        for (const notif of notifsForThisReminder) {
          const dataIso = notif.content.data?.targetDateIso;
          if (dataIso) {
            const list = scheduledByDate.get(dataIso) ?? [];
            list.push(notif.identifier);
            scheduledByDate.set(dataIso, list);
          }
        }

        const validIds: string[] = [];

        // Para cada una de las 24 fechas requeridas del horizonte
        for (const occurrence of targetOccurrences) {
          const iso = getLocalDateString(occurrence);
          const existingIds = scheduledByDate.get(iso);

          if (existingIds && existingIds.length > 0) {
            // Ya existe: conservar la primera y cancelar duplicadas
            validIds.push(existingIds[0]);
            for (let i = 1; i < existingIds.length; i++) {
              await adapter.cancelNotification(existingIds[i]);
              activeScheduledIds.delete(existingIds[i]);
            }
          } else {
            // Falta en el horizonte: programarla
            try {
              const newId = await adapter.scheduleNotification({
                content: {
                  title: reminder.title,
                  body: `Recordatorio mensual (${occurrence.getDate()} de ${MONTH_NAMES_SPANISH[occurrence.getMonth()]}) a las ${reminder.time}`,
                  data: {
                    reminderId: reminder.id,
                    repeatType: 'monthly',
                    time: reminder.time,
                    dayOfMonth,
                    targetDateIso: iso,
                    mode: 'calculated_date_horizon',
                  },
                },
                trigger: {
                  type: 'date',
                  date: occurrence,
                  channelId: ANDROID_CHANNEL_ID,
                  delivery: 'alarmClock',
                },
              });
              validIds.push(newId);
              activeScheduledIds.add(newId);
            } catch (err) {
              console.warn(`[reconcileScheduledNotificationsCore] Error programando fecha ${iso}:`, err);
            }
          }
        }

        // Cancelar notificaciones de este recordatorio fuera del horizonte válido
        for (const notif of notifsForThisReminder) {
          if (!validIds.includes(notif.identifier)) {
            await adapter.cancelNotification(notif.identifier);
            activeScheduledIds.delete(notif.identifier);
          }
        }

        updatedReminders.push({
          ...reminder,
          notificationId: validIds[0],
          notificationIds: validIds,
        });
        continue;
      }

      // --- CASO: ONCE, DAILY, Y MONTHLY (1-28) ---
      if (
        reminder.repeatType === 'once' ||
        reminder.repeatType === 'daily' ||
        (reminder.repeatType === 'monthly' && (reminder.dayOfMonth ?? 15) <= 28)
      ) {
        let matchingNotifId: string | undefined;
        const duplicatesToCancel: string[] = [];

        for (const n of notifsForThisReminder) {
          const data = n.content.data;
          let matches = true;

          if (data?.repeatType && data.repeatType !== reminder.repeatType) {
            matches = false;
          }
          if (data?.time && data.time !== reminder.time) {
            matches = false;
          }
          if (reminder.repeatType === 'monthly' && data?.dayOfMonth !== (reminder.dayOfMonth ?? 15)) {
            matches = false;
          }
          if (reminder.repeatType === 'once' && reminder.targetDate && data?.targetDate !== reminder.targetDate) {
            matches = false;
          }

          if (matches && !matchingNotifId) {
            matchingNotifId = n.identifier;
          } else {
            duplicatesToCancel.push(n.identifier);
          }
        }

        // Cancelar duplicadas u obsoletas
        for (const id of duplicatesToCancel) {
          await adapter.cancelNotification(id);
          activeScheduledIds.delete(id);
        }

        if (matchingNotifId) {
          updatedReminders.push({
            ...reminder,
            notificationId: matchingNotifId,
            notificationIds: [matchingNotifId],
          });
        } else {
          // Reprogramar limpio
          const res = await scheduleReminderNotificationCore(reminder, adapter);
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
        }
        continue;
      }

      // --- CASO: WEEKLY ---
      if (reminder.repeatType === 'weekly') {
        const selectedDays = reminder.days || [];
        if (selectedDays.length === 0) {
          for (const n of notifsForThisReminder) {
            await adapter.cancelNotification(n.identifier);
            activeScheduledIds.delete(n.identifier);
          }
          updatedReminders.push({
            ...reminder,
            notificationId: undefined,
            notificationIds: undefined,
          });
          continue;
        }

        const dayKeyToIds = new Map<string, string[]>();
        const staleIdsToCancel: string[] = [];

        for (const n of notifsForThisReminder) {
          const data = n.content.data;
          const dayKey = data?.dayKey;
          const timeMatches = !data?.time || data.time === reminder.time;
          const typeMatches = data?.repeatType === 'weekly';

          if (dayKey && selectedDays.includes(dayKey) && timeMatches && typeMatches) {
            const list = dayKeyToIds.get(dayKey) ?? [];
            list.push(n.identifier);
            dayKeyToIds.set(dayKey, list);
          } else {
            staleIdsToCancel.push(n.identifier);
          }
        }

        for (const id of staleIdsToCancel) {
          await adapter.cancelNotification(id);
          activeScheduledIds.delete(id);
        }

        const validWeeklyIds: string[] = [];
        let allDaysPresent = true;

        for (const dayKey of selectedDays) {
          const ids = dayKeyToIds.get(dayKey);
          if (ids && ids.length > 0) {
            validWeeklyIds.push(ids[0]);
            // Deduplicar días repetidos
            for (let i = 1; i < ids.length; i++) {
              await adapter.cancelNotification(ids[i]);
              activeScheduledIds.delete(ids[i]);
            }
          } else {
            allDaysPresent = false;
          }
        }

        if (allDaysPresent && validWeeklyIds.length === selectedDays.length) {
          updatedReminders.push({
            ...reminder,
            notificationId: validWeeklyIds[0],
            notificationIds: validWeeklyIds,
          });
        } else {
          // Si faltan días o la hora cambió, limpiar los IDs existentes y reprogramar limpio
          for (const id of validWeeklyIds) {
            await adapter.cancelNotification(id);
            activeScheduledIds.delete(id);
          }

          const res = await scheduleReminderNotificationCore(reminder, adapter);
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
        }
        continue;
      }

      updatedReminders.push(reminder);
    }

    return updatedReminders;
  } catch (err) {
    console.warn('[reconcileScheduledNotificationsCore] Error durante la reconciliación:', err);
    return reminders;
  }
}
