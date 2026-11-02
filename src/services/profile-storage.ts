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

    return {
      name,
      avatarType: 'default',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : undefined,
    };
  } catch (err) {
    console.error('[ProfileStorage] JSON corrupto en perfil:', err);
    throw new ProfileStorageError('El contenido guardado del perfil es inválido o está corrupto.', err);
  }
}

/**
 * Guarda los datos del perfil localmente en AsyncStorage.
 * Valida que el nombre no esté vacío.
 */
export async function saveStoredProfile(
  profileData: { name: string },
  adapter: ProfileStorageAdapter = defaultAdapter
): Promise<UserProfile> {
  const sanitizedName = sanitizeProfileName(profileData.name);

  const updatedProfile: UserProfile = {
    name: sanitizedName,
    avatarType: 'default',
    updatedAt: new Date().toISOString(),
  };

  try {
    await adapter.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile));
    return updatedProfile;
  } catch (err) {
    throw new ProfileStorageError('Error al guardar el perfil en el almacenamiento local.', err);
  }
}

