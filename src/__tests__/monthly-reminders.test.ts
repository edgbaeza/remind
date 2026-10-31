import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

import {
  calculateMonthlyOccurrences,
  getEffectiveMonthlyDay,
} from '../utils/reminder-dates.ts';

describe('Pruebas automatizadas de recordatorios mensuales (Días 28, 29, 30 y 31)', () => {
  describe('1. Cálculo de día efectivo (getEffectiveMonthlyDay)', () => {
    test('Día 28 se mantiene constante en todos los meses y años (normales y bisiestos)', () => {
      // 2027 es año regular (común)
      assert.equal(getEffectiveMonthlyDay(28, 2027, 0), 28, 'Enero 2027 debe ser 28');
      assert.equal(getEffectiveMonthlyDay(28, 2027, 1), 28, 'Febrero 2027 (regular) debe ser 28');
      assert.equal(getEffectiveMonthlyDay(28, 2027, 3), 28, 'Abril 2027 debe ser 28');

      // 2028 es año bisiesto
      assert.equal(getEffectiveMonthlyDay(28, 2028, 1), 28, 'Febrero 2028 (bisiesto) debe ser 28');
    });

    test('Día 29 se ajusta a 28 en año regular y a 29 en bisiesto', () => {
      assert.equal(getEffectiveMonthlyDay(29, 2027, 0), 29, 'Enero 2027 debe ser 29');
      assert.equal(getEffectiveMonthlyDay(29, 2027, 1), 28, 'Febrero 2027 (regular) debe ajustarse a 28');
      assert.equal(getEffectiveMonthlyDay(29, 2028, 1), 29, 'Febrero 2028 (bisiesto) debe mantenerse en 29');
      assert.equal(getEffectiveMonthlyDay(29, 2027, 3), 29, 'Abril 2027 debe ser 29');
    });

    test('Día 30 se ajusta a 28/29 en febrero y a 30 en meses de 30 y 31 días', () => {
      assert.equal(getEffectiveMonthlyDay(30, 2027, 0), 30, 'Enero 2027 debe ser 30');
      assert.equal(getEffectiveMonthlyDay(30, 2027, 1), 28, 'Febrero 2027 (regular) debe ajustarse a 28');
      assert.equal(getEffectiveMonthlyDay(30, 2028, 1), 29, 'Febrero 2028 (bisiesto) debe ajustarse a 29');
      assert.equal(getEffectiveMonthlyDay(30, 2027, 3), 30, 'Abril 2027 debe ser 30');
      assert.equal(getEffectiveMonthlyDay(30, 2027, 4), 30, 'Mayo 2027 debe ser 30');
    });

    test('Día 31 respeta el calendario completo (31, 30, 29 o 28 según el mes)', () => {
      // Meses de 31 días
      assert.equal(getEffectiveMonthlyDay(31, 2027, 0), 31, 'Enero debe ser 31');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 2), 31, 'Marzo debe ser 31');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 4), 31, 'Mayo debe ser 31');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 6), 31, 'Julio debe ser 31');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 7), 31, 'Agosto debe ser 31');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 9), 31, 'Octubre debe ser 31');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 11), 31, 'Diciembre debe ser 31');

      // Meses de 30 días
      assert.equal(getEffectiveMonthlyDay(31, 2027, 3), 30, 'Abril debe ser 30');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 5), 30, 'Junio debe ser 30');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 8), 30, 'Septiembre debe ser 30');
      assert.equal(getEffectiveMonthlyDay(31, 2027, 10), 30, 'Noviembre debe ser 30');

      // Febrero en año común (2027) y bisiesto (2028)
      assert.equal(getEffectiveMonthlyDay(31, 2027, 1), 28, 'Febrero 2027 (común) debe ser 28');
      assert.equal(getEffectiveMonthlyDay(31, 2028, 1), 29, 'Febrero 2028 (bisiesto) debe ser 29');
    });
  });

  describe('2. Generación de horizonte de 24 meses (calculateMonthlyOccurrences)', () => {
    test('Para día 31 genera exactamente 24 ocurrencias consecutivas sin duplicados', () => {
      // Fecha base: 1 de enero de 2027 a las 00:00
      const fromDate = new Date(2027, 0, 1, 0, 0, 0, 0);
      const occurrences = calculateMonthlyOccurrences(31, '08:00 AM', 24, fromDate);

      assert.equal(occurrences.length, 24, 'Debe generar exactamente 24 ocurrencias');

      // Comprobar que no existen duplicados
      const timestamps = occurrences.map((d) => d.getTime());
      const uniqueTimestamps = new Set(timestamps);
      assert.equal(uniqueTimestamps.size, 24, 'Nunca deben existir dos fechas duplicadas');

      // Comprobar orden cronológico estrictamente creciente
      for (let i = 1; i < occurrences.length; i++) {
        assert.ok(
          occurrences[i].getTime() > occurrences[i - 1].getTime(),
          `La ocurrencia ${i} debe ser posterior a la ocurrencia ${i - 1}`
        );
      }

      // Comprobar los primeros 5 meses del ejemplo esperado:
      // 0: Enero 2027 -> 31
      assert.equal(occurrences[0].getFullYear(), 2027);
      assert.equal(occurrences[0].getMonth(), 0);
      assert.equal(occurrences[0].getDate(), 31);
      assert.equal(occurrences[0].getHours(), 8);
      assert.equal(occurrences[0].getMinutes(), 0);

      // 1: Febrero 2027 (año regular) -> 28
      assert.equal(occurrences[1].getFullYear(), 2027);
      assert.equal(occurrences[1].getMonth(), 1);
      assert.equal(occurrences[1].getDate(), 28);

      // 2: Marzo 2027 -> 31
      assert.equal(occurrences[2].getFullYear(), 2027);
      assert.equal(occurrences[2].getMonth(), 2);
      assert.equal(occurrences[2].getDate(), 31);

      // 3: Abril 2027 -> 30
      assert.equal(occurrences[3].getFullYear(), 2027);
      assert.equal(occurrences[3].getMonth(), 3);
      assert.equal(occurrences[3].getDate(), 30);

      // 4: Mayo 2027 -> 31
      assert.equal(occurrences[4].getFullYear(), 2027);
      assert.equal(occurrences[4].getMonth(), 4);
      assert.equal(occurrences[4].getDate(), 31);

      // 13: Febrero 2028 (año bisiesto) -> 29
      assert.equal(occurrences[13].getFullYear(), 2028);
      assert.equal(occurrences[13].getMonth(), 1);
      assert.equal(occurrences[13].getDate(), 29, 'Febrero 2028 debe ajustarse a 29 en bisiesto');
    });

    test('Para día 30 genera 24 ocurrencias sin duplicados respetando febrero', () => {
      const fromDate = new Date(2027, 0, 1, 0, 0, 0, 0);
      const occurrences = calculateMonthlyOccurrences(30, '06:30 PM', 24, fromDate);

      assert.equal(occurrences.length, 24);
      const uniqueIsoDates = new Set(occurrences.map((d) => d.toISOString().slice(0, 10)));
      assert.equal(uniqueIsoDates.size, 24, 'No debe haber fechas ISO duplicadas');

      // Febrero 2027 = 28, Febrero 2028 = 29, resto de meses = 30
      assert.equal(occurrences[1].getDate(), 28);
      assert.equal(occurrences[13].getDate(), 29);
      assert.equal(occurrences[0].getDate(), 30);
      assert.equal(occurrences[2].getDate(), 30);
      assert.equal(occurrences[3].getDate(), 30);
    });

    test('Para día 29 genera 24 ocurrencias sin duplicados', () => {
      const fromDate = new Date(2027, 0, 1, 0, 0, 0, 0);
      const occurrences = calculateMonthlyOccurrences(29, '10:00 AM', 24, fromDate);

      assert.equal(occurrences.length, 24);
      assert.equal(occurrences[1].getDate(), 28, 'Feb 2027 es 28');
      assert.equal(occurrences[13].getDate(), 29, 'Feb 2028 es 29');
      assert.equal(occurrences[0].getDate(), 29, 'Enero es 29');
    });

    test('Solo programa ocurrencias estrictamente futuras respecto a fromDate', () => {
      // Si hoy es 31 de enero de 2027 a las 12:00 PM y el recordatorio es a las 09:00 AM (ya pasó hoy)
      const fromDate = new Date(2027, 0, 31, 12, 0, 0, 0);
      const occurrences = calculateMonthlyOccurrences(31, '09:00 AM', 6, fromDate);

      assert.equal(occurrences.length, 6);
      // La primera ocurrencia debe ser la de febrero de 2027 (día 28), no la de hoy que ya pasó
      assert.equal(occurrences[0].getMonth(), 1, 'La primera ocurrencia futura debe ser febrero');
      assert.equal(occurrences[0].getDate(), 28);
    });
  });
});
