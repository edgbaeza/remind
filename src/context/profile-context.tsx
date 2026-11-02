import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  DEFAULT_PROFILE,
  ProfileStorageError,
  getStoredProfile,
  saveStoredProfile,
} from '@/services/profile-storage';
import type { UserProfile } from '@/types/profile';

interface ProfileContextType {
  profile: UserProfile;
  isLoading: boolean;
  updateName: (newName: string) => Promise<{ success: boolean; error?: string }>;
  reloadProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const stored = await getStoredProfile();
        if (isMounted) {
          setProfile(stored);
        }
      } catch (err) {
        console.warn('[ProfileProvider] No se pudo cargar el perfil guardado. Usando valor por defecto:', err);
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

  const reloadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await getStoredProfile();
      setProfile(stored);
    } catch (err) {
      console.warn('[ProfileProvider] Error al recargar perfil:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateName = useCallback(async (newName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const updated = await saveStoredProfile({ name: newName });
      setProfile(updated);
      return { success: true };
    } catch (err) {
      const message = err instanceof ProfileStorageError ? err.message : 'Error inesperado al guardar el perfil.';
      return { success: false, error: message };
    }
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        updateName,
        reloadProfile,
      }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile debe ser utilizado dentro de un ProfileProvider.');
  }
  return context;
}
