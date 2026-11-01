import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cancelReminderNotificationsCore,
  getReminderNotificationIds,
  reconcileScheduledNotificationsCore,
  scheduleReminderNotificationCore,
} from '../services/notification-core.ts';
import type {
  NotificationAdapter,
  ScheduledNotificationItem,
} from '../services/notification-core.ts';
import type { Reminder } from '../types/reminder.ts';
import { getLocalDateString } from '../utils/reminder-dates.ts';

/**
 * Mock en memoria del sistema de notificaciones para simular operaciones,
 * inspección de triggers, fallos parciales y cancelaciones.
 */
class InMemoryNotificationAdapter implements NotificationAdapter {
  public scheduled = new Map<string, ScheduledNotificationItem>();
  public cancelledIds: string[] = [];
  public failScheduleAtCount = -1; // -1 significa sin fallo
  public failCancelIds = new Set<string>();
  public scheduleCount = 0;
  private idCounter = 1;

  async scheduleNotification(request: {
    content: {
      title: string;
      body: string;
      data: Record<string, unknown>;
    };
    trigger: unknown;
  }): Promise<string> {
    this.scheduleCount++;
    if (this.failScheduleAtCount > 0 && this.scheduleCount === this.failScheduleAtCount) {
      throw new Error(`Fallo simulado al programar notificación número ${this.scheduleCount}`);
    }

    const id = `notif-${this.idCounter++}`;
    const item: ScheduledNotificationItem = {
      identifier: id,
      content: {
        title: request.content.title,
        body: request.content.body,
        data: request.content.data,
      },
      trigger: request.trigger,
    };
    this.scheduled.set(id, item);
    return id;
  }

  async cancelNotification(identifier: string): Promise<boolean> {
    if (this.failCancelIds.has(identifier)) {
      return false;
    }
    this.cancelledIds.push(identifier);
    this.scheduled.delete(identifier);
    return true;
  }

  async getAllScheduled(): Promise<ScheduledNotificationItem[]> {
    return Array.from(this.scheduled.values());
  }
}

describe('Pruebas unitarias de Confiabilidad y Recuperación de Notificaciones (NotificationCore)', () => {
  describe('1. Rollback ante fallos parciales en programación múltiple', () => {
    it('Recordatorio semanal: si falla a mitad del proceso, cancela y limpia las notificaciones ya creadas', async () => {
      const adapter = new InMemoryNotificationAdapter();
      // Configurar fallo simulado en la 3ra notificación (de 5 seleccionadas)
      adapter.failScheduleAtCount = 3;

      const weeklyReminder: Reminder = {
        id: 'rem-weekly-1',
        title: 'Clases de natación',
        time: '07:00 AM',
        frequency: 'Cada Lun, Mar, Mié, Jue, Vie',
        repeatType: 'weekly',
        days: ['L', 'M', 'X', 'J', 'V'],
        isActive: true,
        createdAt: Date.now(),
      };

      const result = await scheduleReminderNotificationCore(weeklyReminder, adapter);

      assert.equal(result.success, false);
      assert.equal(result.error, 'SCHEDULE_FAILED');
      // Las 2 notificaciones que se crearon antes del fallo deben haber sido canceladas por el rollback
      assert.equal(adapter.scheduled.size, 0, 'No deben quedar notificaciones huérfanas en el sistema tras el fallo');
      assert.equal(adapter.cancelledIds.length, 2, 'Las 2 notificaciones parciales debieron ser canceladas');
    });

    it('Recordatorio mensual día 31: si falla en el horizonte, cancela todas las fechas creadas previamente', async () => {
      const adapter = new InMemoryNotificationAdapter();
      // Configurar fallo en la 5ta fecha del horizonte de 24 meses
      adapter.failScheduleAtCount = 5;

      const monthlyReminder: Reminder = {
        id: 'rem-monthly-31',
        title: 'Cierre contable',
        time: '06:00 PM',
        frequency: 'Cada día 31 del mes',
        repeatType: 'monthly',
        dayOfMonth: 31,
        isActive: true,
        createdAt: Date.now(),
      };

      const result = await scheduleReminderNotificationCore(monthlyReminder, adapter);

      assert.equal(result.success, false);
      assert.equal(result.error, 'SCHEDULE_FAILED');
      assert.equal(adapter.scheduled.size, 0, 'El sistema debe quedar completamente limpio tras rollback');
      assert.equal(adapter.cancelledIds.length, 4, 'Las 4 fechas programadas antes del error debieron cancelarse');
    });
  });

  describe('2. Verificación rigurosa de cancelaciones (cancelReminderNotificationsCore)', () => {
    it('Si todas las cancelaciones son exitosas, retorna true', async () => {
      const adapter = new InMemoryNotificationAdapter();
      await adapter.scheduleNotification({
        content: { title: 'T1', body: 'B1', data: { reminderId: 'r1' } },
        trigger: {},
      });
      await adapter.scheduleNotification({
        content: { title: 'T2', body: 'B2', data: { reminderId: 'r1' } },
        trigger: {},
      });

      const allIds = Array.from(adapter.scheduled.keys());
      const success = await cancelReminderNotificationsCore(allIds, adapter);

      assert.equal(success, true);
      assert.equal(adapter.scheduled.size, 0);
    });

    it('Si al menos una cancelación falla, no reporta falso éxito y retorna false', async () => {
      const adapter = new InMemoryNotificationAdapter();
      const id1 = await adapter.scheduleNotification({
        content: { title: 'T1', body: 'B1', data: { reminderId: 'r1' } },
        trigger: {},
      });
      const id2 = await adapter.scheduleNotification({
        content: { title: 'T2', body: 'B2', data: { reminderId: 'r1' } },
        trigger: {},
      });

      // Simular que la cancelación de id2 falla en Android
      adapter.failCancelIds.add(id2);

      const success = await cancelReminderNotificationsCore([id1, id2], adapter);
      assert.equal(success, false, 'No debe considerar exitosa una cancelación donde un ID falló');
      assert.equal(adapter.scheduled.has(id2), true, 'El ID que falló sigue presente en el sistema');
    });

    it('Lista vacía de IDs a cancelar retorna true sin error', async () => {
      const adapter = new InMemoryNotificationAdapter();
      const success = await cancelReminderNotificationsCore([], adapter);
      assert.equal(success, true);
    });

    it('getReminderNotificationIds extrae correctamente IDs individuales y arreglos', () => {
      const remWithArray: Reminder = {
        id: 'r-arr',
        title: 'Prueba',
        time: '08:00 AM',
        frequency: 'Todos los días',
        repeatType: 'daily',
        isActive: true,
        createdAt: 1,
        notificationIds: ['id-1', 'id-2'],
      };
      assert.deepEqual(getReminderNotificationIds(remWithArray), ['id-1', 'id-2']);

      const remWithSingle: Reminder = {
        id: 'r-single',
        title: 'Prueba 2',
        time: '08:00 AM',
        frequency: 'Todos los días',
        repeatType: 'daily',
        isActive: true,
        createdAt: 2,
        notificationId: 'legacy-id',
      };
      assert.deepEqual(getReminderNotificationIds(remWithSingle), ['legacy-id']);

      const remEmpty: Reminder = {
        id: 'r-none',
        title: 'Prueba 3',
        time: '08:00 AM',
        frequency: 'Todos los días',
        repeatType: 'daily',
        isActive: true,
        createdAt: 3,
      };
      assert.deepEqual(getReminderNotificationIds(remEmpty), []);
    });
  });

  describe('3. Detección y limpieza de notificaciones huérfanas en reconciliación', () => {
    it('Cancela notificaciones huérfanas de recordatorios eliminados o inactivos', async () => {
      const adapter = new InMemoryNotificationAdapter();

      // Notificación huérfana de un recordatorio que ya no existe
      const orphanId = await adapter.scheduleNotification({
        content: {
          title: 'Recordatorio borrado',
          body: 'Aviso',
          data: { reminderId: 'rem-eliminado', repeatType: 'daily' },
        },
        trigger: {},
      });

      // Notificación de un recordatorio que ahora está inactivo
      const inactiveId = await adapter.scheduleNotification({
        content: {
          title: 'Recordatorio pausado',
          body: 'Aviso',
          data: { reminderId: 'rem-inactivo', repeatType: 'daily' },
        },
        trigger: {},
      });

      const reminders: Reminder[] = [
        {
          id: 'rem-inactivo',
          title: 'Recordatorio pausado',
          time: '08:00 AM',
          frequency: 'Todos los días',
          repeatType: 'daily',
          isActive: false, // Inactivo
          notificationId: inactiveId,
          createdAt: 1,
        },
      ];

      await reconcileScheduledNotificationsCore(reminders, adapter);

      assert.equal(adapter.scheduled.has(orphanId), false, 'La notificación del recordatorio eliminado debe ser cancelada');
      assert.equal(adapter.scheduled.has(inactiveId), false, 'La notificación del recordatorio inactivo debe ser cancelada');
    });

    it('NO cancela notificaciones de prueba (type === "test_notification") ni ajenas a Remind', async () => {
      const adapter = new InMemoryNotificationAdapter();

      // Notificación de diagnóstico de Remind
      const testNotifId = await adapter.scheduleNotification({
        content: {
          title: 'Recordatorio de prueba',
          body: 'Prueba Beta 0.1',
          data: { type: 'test_notification', scheduledAt: Date.now() },
        },
        trigger: {},
      });

      // Notificación ajena del sistema sin reminderId
      const thirdPartyId = await adapter.scheduleNotification({
        content: {
          title: 'Aviso del sistema',
          body: 'Actualización disponible',
          data: {},
        },
        trigger: {},
      });

      const reminders: Reminder[] = []; // Sin recordatorios activos
      await reconcileScheduledNotificationsCore(reminders, adapter);

      assert.equal(adapter.scheduled.has(testNotifId), true, 'La notificación de prueba debe ser preservada intacta');
      assert.equal(adapter.scheduled.has(thirdPartyId), true, 'Notificaciones sin reminderId no deben ser tocadas');
    });
  });

  describe('4. Deduplicación y actualización ante cambios de parámetros', () => {
    it('Deduplica notificaciones repetidas para el mismo recordatorio y conserva solo una', async () => {
      const adapter = new InMemoryNotificationAdapter();

      // Programar 2 notificaciones duplicadas para el mismo recordatorio diario
      const notif1 = await adapter.scheduleNotification({
        content: {
          title: 'Pasear al perro',
          body: 'Diario',
          data: { reminderId: 'rem-dog', repeatType: 'daily', time: '08:00 AM' },
        },
        trigger: {},
      });

      const notif2 = await adapter.scheduleNotification({
        content: {
          title: 'Pasear al perro',
          body: 'Diario',
          data: { reminderId: 'rem-dog', repeatType: 'daily', time: '08:00 AM' },
        },
        trigger: {},
      });

      const reminders: Reminder[] = [
        {
          id: 'rem-dog',
          title: 'Pasear al perro',
          time: '08:00 AM',
          frequency: 'Todos los días',
          repeatType: 'daily',
          isActive: true,
          notificationId: notif1,
          createdAt: 1,
        },
      ];

      const reconciled = await reconcileScheduledNotificationsCore(reminders, adapter);

      assert.equal(adapter.scheduled.size, 1, 'Debe quedar exactamente 1 notificación tras deduplicar');
      assert.equal(reconciled[0].notificationIds?.length, 1);
      assert.ok(adapter.cancelledIds.includes(notif2), 'La notificación duplicada debe haber sido cancelada');
    });

    it('Detecta cambio de hora en recordatorio y renueva la notificación en vez de reutilizar la vieja', async () => {
      const adapter = new InMemoryNotificationAdapter();

      // Notificación existente con la hora antigua (08:00 AM)
      const oldNotifId = await adapter.scheduleNotification({
        content: {
          title: 'Tomar vitamina',
          body: 'Aviso',
          data: { reminderId: 'rem-vit', repeatType: 'daily', time: '08:00 AM' },
        },
        trigger: {},
      });

      // El recordatorio ahora tiene hora 10:00 AM
      const reminders: Reminder[] = [
        {
          id: 'rem-vit',
          title: 'Tomar vitamina',
          time: '10:00 AM', // Hora cambiada
          frequency: 'Todos los días',
          repeatType: 'daily',
          isActive: true,
          notificationId: oldNotifId,
          createdAt: 1,
        },
      ];

      const reconciled = await reconcileScheduledNotificationsCore(reminders, adapter);

      assert.ok(adapter.cancelledIds.includes(oldNotifId), 'La notificación con hora obsoleta debe ser cancelada');
      assert.notEqual(reconciled[0].notificationId, oldNotifId, 'Debe haberse generado un nuevo ID con la hora actualizada');
      assert.equal(adapter.scheduled.size, 1);

      const activeNotif = Array.from(adapter.scheduled.values())[0];
      assert.equal(activeNotif.content.data?.time, '10:00 AM');
    });

    it('Transición de mensual día 31 a día 15: cancela el horizonte y establece activador nativo', async () => {
      const adapter = new InMemoryNotificationAdapter();

      // Programar horizonte para día 31
      const rem31: Reminder = {
        id: 'rem-month',
        title: 'Pagar servicio',
        time: '09:00 AM',
        frequency: 'Cada día 31 del mes',
        repeatType: 'monthly',
        dayOfMonth: 31,
        isActive: true,
        createdAt: 1,
      };

      const res31 = await scheduleReminderNotificationCore(rem31, adapter);
      assert.equal(res31.success, true);
      assert.equal(adapter.scheduled.size, 24, 'Debe haber 24 fechas de horizonte');

      // Ahora el usuario cambia a día 15
      const rem15: Reminder = {
        ...rem31,
        frequency: 'Cada día 15 del mes',
        dayOfMonth: 15,
        notificationIds: res31.notificationIds,
        notificationId: res31.notificationId,
      };

      const reconciled = await reconcileScheduledNotificationsCore([rem15], adapter);

      // El día 15 usa activador nativo mensual (1 solo ID)
      assert.equal(reconciled[0].notificationIds?.length, 1);
      assert.equal(adapter.scheduled.size, 1);
      const activeNotif = Array.from(adapter.scheduled.values())[0];
      assert.equal(activeNotif.content.data?.dayOfMonth, 15);
      assert.equal(activeNotif.content.data?.mode, 'native_monthly');
    });
  });

  describe('5. Formato de fechas en horizonte mensual', () => {
    it('Utiliza fechas locales sin desfase UTC para targetDateIso', async () => {
      const adapter = new InMemoryNotificationAdapter();

      const reminder30: Reminder = {
        id: 'rem-30',
        title: 'Reporte mensual',
        time: '11:30 PM', // Hora cercana a la medianoche
        frequency: 'Cada día 30 del mes',
        repeatType: 'monthly',
        dayOfMonth: 30,
        isActive: true,
        createdAt: Date.now(),
      };

      const res = await scheduleReminderNotificationCore(reminder30, adapter);
      assert.equal(res.success, true);

      // Comprobar que todos los targetDateIso coinciden exactamente con getLocalDateString
      for (const notif of adapter.scheduled.values()) {
        const trigger = notif.trigger as { date?: Date };
        if (trigger.date) {
          const expectedLocalIso = getLocalDateString(trigger.date);
          assert.equal(
            notif.content.data?.targetDateIso,
            expectedLocalIso,
            'targetDateIso debe coincidir con la fecha local del dispositivo sin sesgo UTC'
          );
        }
      }
    });
  });
});
