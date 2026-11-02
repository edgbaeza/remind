import AsyncStorage from '@react-native-async-storage/async-storage';

import type { UserProfile } from '../types/profile.ts';

export const PROFILE_STORAGE_KEY = '@remind_app/profile_v1';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Mi perfil',
  avatarType: 'default',
};

export class ProfileStorageError extends Error {
  override cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ProfileStorageError';
    this.cause = cause;
  }
}

export interface ProfileStorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

const defaultAdapter: ProfileStorageAdapter = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
};

/**
 * Valida y limpia el nombre de usuario.
 * Lanza un error si el nombre está vacío o compuesto exclusivamente por espacios en blanco.
 */
export function sanitizeProfileName(rawName: string): string {
  if (typeof rawName !== 'string') {
    throw new ProfileStorageError('El nombre debe ser una cadena de texto.');
  }
  const trimmed = rawName.trim();
  if (trimmed.length === 0) {
    throw new ProfileStorageError('El nombre no puede estar vacío.');
  }
  if (trimmed.length > 50) {
    return trimmed.slice(0, 50);
  }
  return trimmed;
}

/**
 * Obtiene el perfil de usuario almacenado en AsyncStorage.
 * Si no existe una configuración previa, retorna el perfil predeterminado.
 */
export async function getStoredProfile(
  adapter: ProfileStorageAdapter = defaultAdapter
): Promise<UserProfile> {
  let rawJson: string | null = null;
  try {
    rawJson = await adapter.getItem(PROFILE_STORAGE_KEY);
  } catch (err) {
    throw new ProfileStorageError('Error al leer el perfil desde el almacenamiento local.', err);
  }

  if (!rawJson) {
    return { ...DEFAULT_PROFILE };
  }

  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      console.warn('[ProfileStorage] Estructura inválida en almacenamiento. Usando perfil por defecto.');
      return { ...DEFAULT_PROFILE };
    }

    const name = typeof parsed.name === 'string' && parsed.name.trim().length > 0
      ? parsed.name.trim()
      : DEFAULT_PROFILE.name;

    const avatarType: 'default' | 'custom' =
      parsed.avatarType === 'custom' && typeof parsed.avatarUri === 'string' && parsed.avatarUri.trim().length > 0
        ? 'custom'
        : 'default';

    const avatarUri = avatarType === 'custom' ? parsed.avatarUri.trim() : undefined;

    return {
      name,
      avatarType,
      avatarUri,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch (err) {
    console.error('[ProfileStorage] JSON corrupto en perfil:', err);
    throw new ProfileStorageError('El contenido guardado del perfil es inválido o está corrupto.', err);
  }
}

export interface SaveProfileInput {
  name?: string;
  avatarType?: 'default' | 'custom';
  avatarUri?: string | null;
}

/**
 * Guarda los datos del perfil localmente en AsyncStorage.
 * Permite actualizar selectivamente el nombre, el tipo de avatar y la URI de la fotografía.
 * Si la lectura previa falla o detecta datos corruptos, detiene el guardado para evitar
 * sobrescribir o perder los datos existentes.
 */
export async function saveStoredProfile(
  profileData: SaveProfileInput,
  adapter: ProfileStorageAdapter = defaultAdapter
): Promise<UserProfile> {
  // Obtener perfil actual; si falla la lectura o los datos están corruptos,
  // la excepción se propaga y se detiene el proceso para evitar sobrescribir datos.
  const currentProfile = await getStoredProfile(adapter);

  let finalName = currentProfile.name;
  if (profileData.name !== undefined) {
    finalName = sanitizeProfileName(profileData.name);
  }

  let finalAvatarType: 'default' | 'custom' = currentProfile.avatarType;
  let finalAvatarUri: string | undefined = currentProfile.avatarUri;

  if (profileData.avatarType !== undefined) {
    finalAvatarType = profileData.avatarType;
    if (finalAvatarType === 'default') {
      finalAvatarUri = undefined;
    }
  }

  if (profileData.avatarUri !== undefined) {
    if (profileData.avatarUri && profileData.avatarUri.trim().length > 0) {
      finalAvatarUri = profileData.avatarUri.trim();
      finalAvatarType = 'custom';
    } else {
      finalAvatarUri = undefined;
      finalAvatarType = 'default';
    }
  }

  const updatedProfile: UserProfile = {
    name: finalName,
    avatarType: finalAvatarType === 'custom' && finalAvatarUri ? 'custom' : 'default',
    avatarUri: finalAvatarType === 'custom' && finalAvatarUri ? finalAvatarUri : undefined,
    updatedAt: new Date().toISOString(),
  };

  try {
    await adapter.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile));
    return updatedProfile;
  } catch (err) {
    throw new ProfileStorageError('Error al guardar el perfil en el almacenamiento local.', err);
  }
}
