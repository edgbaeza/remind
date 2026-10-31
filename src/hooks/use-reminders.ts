import { useCallback, useEffect, useState } from 'react';

import {
  getStoredReminders,
  saveStoredReminders,
} from '@/services/reminder-storage';
import { Reminder } from '@/types/reminder';

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carga inicial persistida
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const loadedReminders = await getStoredReminders();
        if (isMounted) {
          setReminders(loadedReminders);
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

      const newReminder: Reminder = {
        ...newReminderData,
        id: Date.now().toString(),
        createdAt: Date.now(),
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

      setReminders((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, ...updatedData } : item
        );
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading]
  );

  const toggleReminder = useCallback(
    async (id: string) => {
      if (isLoading) return;

      setReminders((prev) => {
        const updated = prev.map((item) =>
          item.id === id ? { ...item, isActive: !item.isActive } : item
        );
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading]
  );

  const deleteReminder = useCallback(
    async (id: string) => {
      if (isLoading) return;

      setReminders((prev) => {
        const updated = prev.filter((item) => item.id !== id);
        saveStoredReminders(updated);
        return updated;
      });
    },
    [isLoading]
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

