import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { getLocalDateString } from '@/utils/reminder-dates';

/**
 * Hook que provee la fecha local actual y se actualiza automáticamente:
 * 1. Cuando la aplicación regresa desde segundo plano a primer plano (AppState active).
 * 2. Al llegar la medianoche local si la app permanece abierta en pantalla.
 *
 * Limpia correctamente los temporizadores y suscripciones sin emitir renders innecesarios.
 */
export function useTodayDate(): { todayDate: Date; todayStr: string } {
  const [todayDate, setTodayDate] = useState<Date>(() => new Date());
  const [todayStr, setTodayStr] = useState<string>(() => getLocalDateString());

  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const syncDate = () => {
      const now = new Date();
      const currentStr = getLocalDateString(now);
      setTodayDate(now);
      setTodayStr(currentStr);
      scheduleMidnight();
    };

    const scheduleMidnight = () => {
      if (midnightTimer) {
        clearTimeout(midnightTimer);
      }
      const now = new Date();
      // Próxima medianoche local a las 00:00:00.100 del día siguiente
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0,
        100
      );
      const msUntilMidnight = Math.max(nextMidnight.getTime() - now.getTime(), 1000);
      midnightTimer = setTimeout(syncDate, msUntilMidnight);
    };

    scheduleMidnight();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const currentStr = getLocalDateString();
        // Si el día calendario cambió mientras la app estaba en segundo plano, sincronizar
        if (currentStr !== todayStr) {
          syncDate();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (midnightTimer) {
        clearTimeout(midnightTimer);
      }
      subscription.remove();
    };
  }, [todayStr]);

  return { todayDate, todayStr };
}
