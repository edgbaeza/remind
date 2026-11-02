import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  copyPhotoToPersistentStorage,
  deletePhotoFile,
  doesPhotoFileExist,
} from '@/services/profile-photo-service';
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
  updateAvatarPhoto: (sourceUri: string) => Promise<{ success: boolean; error?: string }>;
  restoreDefaultAvatar: () => Promise<{ success: boolean; error?: string }>;
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

        // Si la foto personalizada ya no existe físicamente en el disco, restaurar de forma segura
        if (stored.avatarType === 'custom' && stored.avatarUri) {
          if (!doesPhotoFileExist(stored.avatarUri)) {
            console.warn('[ProfileProvider] Foto no encontrada en disco. Restaurando avatar predeterminado.');
            stored.avatarType = 'default';
            stored.avatarUri = undefined;
            await saveStoredProfile({ avatarType: 'default', avatarUri: null });
          }
        }

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
      if (stored.avatarType === 'custom' && stored.avatarUri && !doesPhotoFileExist(stored.avatarUri)) {
        stored.avatarType = 'default';
        stored.avatarUri = undefined;
        await saveStoredProfile({ avatarType: 'default', avatarUri: null });
      }
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

  const updateAvatarPhoto = useCallback(
    async (tempUri: string): Promise<{ success: boolean; error?: string }> => {
      let persistentUri: string | null = null;
      try {
        // 1. Copiar imagen al directorio persistente seguro
        persistentUri = await copyPhotoToPersistentStorage(tempUri);

        // 2. Referencia anterior para limpieza tras guardar
        const previousUri = profile.avatarUri;

        // 3. Persistir en AsyncStorage
        const updated = await saveStoredProfile({
          avatarType: 'custom',
          avatarUri: persistentUri,
        });

        // 4. Actualizar estado reactivo
        setProfile(updated);

        // 5. Eliminar la foto anterior solo si la nueva se guardó exitosamente
        if (previousUri && previousUri !== persistentUri) {
          deletePhotoFile(previousUri);
        }

        return { success: true };
      } catch (err) {
        console.error('[ProfileProvider] Error al actualizar la foto de perfil:', err);
        // Si se copió el nuevo archivo pero falló el guardado, limpiar para evitar huérfanos
        if (persistentUri) {
          deletePhotoFile(persistentUri);
        }
        return { success: false, error: 'No fue posible guardar la fotografía seleccionada.' };
      }
    },
    [profile.avatarUri]
  );

  const restoreDefaultAvatar = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const previousUri = profile.avatarUri;

      const updated = await saveStoredProfile({
        avatarType: 'default',
        avatarUri: null,
      });

      setProfile(updated);

      if (previousUri) {
        deletePhotoFile(previousUri);
      }

      return { success: true };
    } catch (err) {
      console.error('[ProfileProvider] Error al restaurar avatar predeterminado:', err);
      return { success: false, error: 'No fue posible restaurar el avatar predeterminado.' };
    }
  }, [profile.avatarUri]);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        isLoading,
        updateName,
        updateAvatarPhoto,
        restoreDefaultAvatar,
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
