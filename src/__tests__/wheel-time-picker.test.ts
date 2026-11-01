import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_HOURS,
  BASE_MINUTES,
  formatSelectedTime,
  getBaseIndex,
  HOURS_CYCLES,
  HOURS_DATA,
  HOURS_MIDDLE_CYCLE,
  MINUTES_CYCLES,
  MINUTES_DATA,
  MINUTES_MIDDLE_CYCLE,
  parseTimeToState,
  PERIODS,
  shouldRecenter,
} from '../utils/wheel-time-utils.ts';

describe('Pruebas unitarias de WheelTimePicker (Desplazamiento infinito y utilidades)', () => {
  describe('1. Conversión de string a estado (parseTimeToState)', () => {
    it('Convierte correctamente 12:00 AM a medianoche (hora 12, a.m.)', () => {
      const state = parseTimeToState('12:00 AM');
      assert.equal(state.hour12, 12);
      assert.equal(state.minute, 0);
      assert.equal(state.period, 'a.m.');
    });

    it('Convierte correctamente 12:00 PM al mediodía (hora 12, p.m.)', () => {
      const state = parseTimeToState('12:00 PM');
      assert.equal(state.hour12, 12);
      assert.equal(state.minute, 0);
      assert.equal(state.period, 'p.m.');
    });

    it('Convierte correctamente 08:30 AM', () => {
      const state = parseTimeToState('08:30 AM');
      assert.equal(state.hour12, 8);
      assert.equal(state.minute, 30);
      assert.equal(state.period, 'a.m.');
    });

    it('Convierte correctamente 06:45 PM', () => {
      const state = parseTimeToState('06:45 PM');
      assert.equal(state.hour12, 6);
      assert.equal(state.minute, 45);
      assert.equal(state.period, 'p.m.');
    });

    it('Acepta formato con puntos "a.m." o "p.m."', () => {
      const state = parseTimeToState('09:15 p.m.');
      assert.equal(state.hour12, 9);
      assert.equal(state.minute, 15);
      assert.equal(state.period, 'p.m.');
    });

    it('Retorna valor por defecto seguro ante string inválido', () => {
      const state = parseTimeToState('invalid_time');
      assert.equal(state.hour12, 8);
      assert.equal(state.minute, 0);
      assert.equal(state.period, 'a.m.');
    });
  });

  describe('2. Formato de hora seleccionada (formatSelectedTime)', () => {
    it('Formatea 12:00 AM correctamente con ceros a la izquierda', () => {
      const formatted = formatSelectedTime(12, 0, 'a.m.');
      assert.equal(formatted, '12:00 AM');
    });

    it('Formatea 12:00 PM correctamente', () => {
      const formatted = formatSelectedTime(12, 0, 'p.m.');
      assert.equal(formatted, '12:00 PM');
    });

    it('Formatea horas y minutos de un solo dígito con relleno "0"', () => {
      const formatted = formatSelectedTime(8, 5, 'a.m.');
      assert.equal(formatted, '08:05 AM');
    });

    it('Formatea 11:59 PM correctamente', () => {
      const formatted = formatSelectedTime(11, 59, 'p.m.');
      assert.equal(formatted, '11:59 PM');
    });
  });

  describe('3. Rueda circular infinita de Horas (1 a 12)', () => {
    it('Tiene una longitud finita adecuada en memoria (120 ciclos = 1440 elementos)', () => {
      assert.equal(BASE_HOURS.length, 12);
      assert.equal(HOURS_DATA.length, 12 * HOURS_CYCLES);
      assert.equal(HOURS_DATA.length, 1440);
    });

    it('Ciclo central posiciona la hora 12 y la hora 1 en índices contiguos (12 -> 1)', () => {
      // En el ciclo central:
      // Hora 12 está en el último índice del ciclo: (middleCycle * 12) + 11
      const hour12Index = HOURS_MIDDLE_CYCLE * 12 + 11;
      // El siguiente elemento es el primero del ciclo siguiente: hora 1
      const hour1NextIndex = hour12Index + 1;

      assert.equal(HOURS_DATA[hour12Index], 12);
      assert.equal(HOURS_DATA[hour1NextIndex], 1);
    });

    it('Retroceso antes de la hora 1 muestra la hora 12 (1 -> 12)', () => {
      // Hora 1 en el ciclo central: middleCycle * 12 + 0
      const hour1Index = HOURS_MIDDLE_CYCLE * 12 + 0;
      // El elemento anterior es la hora 12 del ciclo previo
      const hour12PrevIndex = hour1Index - 1;

      assert.equal(HOURS_DATA[hour1Index], 1);
      assert.equal(HOURS_DATA[hour12PrevIndex], 12);
    });

    it('Permite múltiples giros completos hacia adelante y hacia atrás', () => {
      const baseIndex = 7; // Hora 8
      const middleIndex = HOURS_MIDDLE_CYCLE * 12 + baseIndex;
      assert.equal(HOURS_DATA[middleIndex], 8);

      // 5 giros completos hacia adelante (+60 elementos)
      const forward5Spins = middleIndex + 12 * 5;
      assert.equal(HOURS_DATA[forward5Spins], 8);

      // 5 giros completos hacia atrás (-60 elementos)
      const backward5Spins = middleIndex - 12 * 5;
      assert.equal(HOURS_DATA[backward5Spins], 8);
    });

    it('getBaseIndex calcula el valor base correcto sin importar la vuelta', () => {
      assert.equal(getBaseIndex(HOURS_MIDDLE_CYCLE * 12 + 0, 12), 0); // Hora 1
      assert.equal(getBaseIndex(HOURS_MIDDLE_CYCLE * 12 + 11, 12), 11); // Hora 12
      assert.equal(getBaseIndex(HOURS_MIDDLE_CYCLE * 12 + 12, 12), 0); // Vuelta siguiente: Hora 1
      assert.equal(getBaseIndex(HOURS_MIDDLE_CYCLE * 12 - 1, 12), 11); // Vuelta anterior: Hora 12
    });
  });

  describe('4. Rueda circular infinita de Minutos (00 a 59)', () => {
    it('Tiene una longitud finita adecuada en memoria (60 ciclos = 3600 elementos)', () => {
      assert.equal(BASE_MINUTES.length, 60);
      assert.equal(MINUTES_DATA.length, 60 * MINUTES_CYCLES);
      assert.equal(MINUTES_DATA.length, 3600);
    });

    it('Ciclo central posiciona el minuto 59 y el minuto 00 en índices contiguos (59 -> 00)', () => {
      // Minuto 59 del ciclo central: middleCycle * 60 + 59
      const minute59Index = MINUTES_MIDDLE_CYCLE * 60 + 59;
      // Siguiente elemento: minuto 00 del ciclo posterior
      const minute00NextIndex = minute59Index + 1;

      assert.equal(MINUTES_DATA[minute59Index], '59');
      assert.equal(MINUTES_DATA[minute00NextIndex], '00');
    });

    it('Retroceso antes del minuto 00 muestra el minuto 59 (00 -> 59)', () => {
      // Minuto 00 del ciclo central: middleCycle * 60 + 0
      const minute00Index = MINUTES_MIDDLE_CYCLE * 60 + 0;
      // Elemento anterior: minuto 59 del ciclo previo
      const minute59PrevIndex = minute00Index - 1;

      assert.equal(MINUTES_DATA[minute00Index], '00');
      assert.equal(MINUTES_DATA[minute59PrevIndex], '59');
    });

    it('Permite giros rápidos de múltiples minutos sin desincronización', () => {
      const minute30 = 30;
      const middleIndex = MINUTES_MIDDLE_CYCLE * 60 + minute30;
      assert.equal(MINUTES_DATA[middleIndex], '30');

      // +75 minutos (1 ciclo completo y 15 minutos más = 45)
      const forward75 = middleIndex + 75;
      assert.equal(MINUTES_DATA[forward75], '45');

      // -40 minutos (debería ser 50)
      const backward40 = middleIndex - 40;
      assert.equal(MINUTES_DATA[backward40], '50');
    });

    it('shouldRecenter activa el recentrado solo cuando se acerca a los extremos', () => {
      // En la zona segura (entre 10 y 50) no debe recentrar
      assert.equal(shouldRecenter(30, 10, 50), false);
      assert.equal(shouldRecenter(20, 10, 50), false);
      assert.equal(shouldRecenter(45, 10, 50), false);

      // En los extremos (<10 o >50) debe activar el recentrado silencioso
      assert.equal(shouldRecenter(5, 10, 50), true);
      assert.equal(shouldRecenter(55, 10, 50), true);
    });
  });

  describe('5. Rueda AM/PM (No infinita)', () => {
    it('Mantiene exactamente 2 opciones sin ciclos artificiales', () => {
      assert.equal(PERIODS.length, 2);
      assert.equal(PERIODS[0], 'a.m.');
      assert.equal(PERIODS[1], 'p.m.');
    });
  });
});
