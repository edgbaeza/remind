import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  RemindersContextProvider,
  type RemindersContextValue,
  useRemindersContext,
} from '../context/reminders-context-core.ts';
import { AsyncQueue } from '../services/reminder-storage.ts';
import type { Reminder } from '../types/reminder.ts';

/**
 * Crea un controlador simulado con la misma estructura y cola secuencial que useRemindersController,
 * contabilizando cuántas veces se ejecutan la carga inicial y la reconciliación.
 */
function createMockRemindersController(initialData: Reminder[] = []) {
  let reminders: Reminder[] = [...initialData];
  let isLoading = true;
  let loadCount = 0;
  let reconcileCount = 0;
  const queue = new AsyncQueue();

  const initialize = async () => {
    loadCount += 1;
    reconcileCount += 1;
    isLoading = false;
  };

  const getValue = (): RemindersContextValue => ({
    reminders,
    isLoading,
    addReminder: async (data) => {
      await queue.enqueue(async () => {
        const newReminder: Reminder = {
          ...data,
          id: `id-${reminders.length + 1}`,
          createdAt: Date.now(),
        };
        reminders = [newReminder, ...reminders];
      });
    },
    updateReminder: async (id, updatedData) => {
      await queue.enqueue(async () => {
        reminders = reminders.map((item) =>
          item.id === id ? { ...item, ...updatedData, id } : item
        );
      });
    },
    toggleReminder: async (id) => {
      await queue.enqueue(async () => {
        reminders = reminders.map((item) =>
          item.id === id ? { ...item, isActive: !item.isActive } : item
        );
      });
    },
    deleteReminder: async (id) => {
      await queue.enqueue(async () => {
        reminders = reminders.filter((item) => item.id !== id);
      });
    },
  });

  return {
    initialize,
    getValue,
    getStats: () => ({ loadCount, reconcileCount }),
  };
}

describe('Pruebas unitarias de Estado Compartido de Recordatorios (RemindersContext)', () => {
  it('Lanza un error descriptivo si useRemindersContext se invoca fuera de RemindersProvider', () => {
    function OrphanScreen() {
      useRemindersContext();
      return null;
    }

    assert.throws(
      () => {
        renderToStaticMarkup(React.createElement(OrphanScreen));
      },
      (err: unknown) =>
        err instanceof Error &&
        err.message.includes('useReminders debe ser utilizado dentro de un RemindersProvider')
    );
  });

  it('Inicio y Calendario consumen exactamente la misma instancia de estado desde el proveedor compartido', async () => {
    const initialList: Reminder[] = [
      {
        id: 'rem-1',
        title: 'Cita médica',
        time: '09:00 AM',
        frequency: 'Una vez',
        repeatType: 'once',
        targetDate: '2027-11-15',
        isActive: true,
        category: 'salud',
        createdAt: 1000,
      },
    ];

    const controller = createMockRemindersController(initialList);
    await controller.initialize();

    let capturedInicio: RemindersContextValue | null = null;
    let capturedCalendario: RemindersContextValue | null = null;

    function SimulatedInicioScreen() {
      capturedInicio = useRemindersContext();
      return React.createElement('div', null, `Inicio: ${capturedInicio.reminders.length}`);
    }

    function SimulatedCalendarioScreen() {
      capturedCalendario = useRemindersContext();
      return React.createElement('div', null, `Calendario: ${capturedCalendario.reminders.length}`);
    }

    const sharedValue = controller.getValue();

    renderToStaticMarkup(
      React.createElement(
        RemindersContextProvider,
        { value: sharedValue },
        React.createElement(SimulatedInicioScreen),
        React.createElement(SimulatedCalendarioScreen)
      )
    );

    assert.ok(capturedInicio);
    assert.ok(capturedCalendario);

    // Ambas pantallas reciben exactamente la misma referencia y lista de recordatorios
    assert.strictEqual(capturedInicio, capturedCalendario);
    assert.strictEqual(capturedInicio.reminders, capturedCalendario.reminders);
    assert.equal(capturedInicio.reminders.length, 1);
    assert.equal(capturedCalendario.reminders[0].title, 'Cita médica');
    assert.equal(controller.getStats().loadCount, 1);
    assert.equal(controller.getStats().reconcileCount, 1);
  });

  it('Crear, editar, pausar y eliminar desde una pantalla actualiza el estado compartido para ambas sin volver a reconciliar', async () => {
    const controller = createMockRemindersController([]);
    await controller.initialize();

    let inicioState: RemindersContextValue | null = null;
    let calendarioState: RemindersContextValue | null = null;

    function InicioConsumer() {
      inicioState = useRemindersContext();
      return null;
    }

    function CalendarioConsumer() {
      calendarioState = useRemindersContext();
      return null;
    }

    const renderBothScreens = () => {
      renderToStaticMarkup(
        React.createElement(
          RemindersContextProvider,
          { value: controller.getValue() },
          React.createElement(InicioConsumer),
          React.createElement(CalendarioConsumer)
        )
      );
    };

    renderBothScreens();
    assert.equal(inicioState!.reminders.length, 0);
    assert.equal(calendarioState!.reminders.length, 0);

    // 1. Crear un recordatorio desde Inicio
    await inicioState!.addReminder({
      title: 'Pagar factura',
      time: '10:30 AM',
      frequency: 'Todos los días',
      repeatType: 'daily',
      isActive: true,
      category: 'finanzas',
    });
    renderBothScreens();

    assert.equal(inicioState!.reminders.length, 1);
    assert.equal(calendarioState!.reminders.length, 1);
    assert.equal(calendarioState!.reminders[0].title, 'Pagar factura');

    const createdId = inicioState!.reminders[0].id;

    // 2. Editar el recordatorio
    await inicioState!.updateReminder(createdId, { title: 'Pagar factura de luz' });
    renderBothScreens();
    assert.equal(calendarioState!.reminders[0].title, 'Pagar factura de luz');

    // 3. Pausar el recordatorio (toggle)
    await inicioState!.toggleReminder(createdId);
    renderBothScreens();
    assert.equal(inicioState!.reminders[0].isActive, false);
    assert.equal(calendarioState!.reminders[0].isActive, false);

    // 4. Eliminar el recordatorio
    await inicioState!.deleteReminder(createdId);
    renderBothScreens();
    assert.equal(inicioState!.reminders.length, 0);
    assert.equal(calendarioState!.reminders.length, 0);

    // Verificar que la carga y reconciliación solo ocurrieron 1 vez al inicio
    assert.deepEqual(controller.getStats(), {
      loadCount: 1,
      reconcileCount: 1,
    });
  });
});
