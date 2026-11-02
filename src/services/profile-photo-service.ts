import { Directory, File, Paths } from 'expo-file-system';

const PROFILE_PHOTOS_DIR = 'profile-photos';

/**
 * Asegura la existencia del directorio persistente para fotos de perfil en Paths.document.
 */
export function getProfilePhotosDirectory(): Directory {
  const dir = new Directory(Paths.document, PROFILE_PHOTOS_DIR);
  if (!dir.exists) {
    dir.create({ idempotent: true });
  }
  return dir;
}

/**
 * Copia una fotografía seleccionada desde una ubicación temporal a un directorio persistente de Remind.
 * Retorna la URI persistente del archivo final.
 */
export async function copyPhotoToPersistentStorage(sourceUri: string): Promise<string> {
  const profileDir = getProfilePhotosDirectory();

  // Extraer extensión del archivo o usar .jpg por defecto
  const cleanUri = sourceUri.split('?')[0];
  const dotIndex = cleanUri.lastIndexOf('.');
  const ext = dotIndex !== -1 ? cleanUri.slice(dotIndex).toLowerCase() : '.jpg';
  const validExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';

  const fileName = `profile_${Date.now()}_${Math.floor(Math.random() * 10000)}${validExt}`;
  const destFile = new File(profileDir, fileName);
  const sourceFile = new File(sourceUri);

  await sourceFile.copy(destFile);
  return destFile.uri;
}

/**
 * Elimina un archivo de foto de perfil existente de forma segura sin arrojar excepciones no controladas.
 */
export function deletePhotoFile(fileUri?: string | null): void {
  if (!fileUri) return;
  try {
    const file = new File(fileUri);
    if (file.exists) {
      file.delete();
    }
  } catch (err) {
    console.warn('[ProfilePhotoService] No fue posible eliminar el archivo de foto anterior:', err);
  }
}

/**
 * Comprueba si el archivo físico de la fotografía de perfil existe en el sistema de archivos local.
 */
export function doesPhotoFileExist(fileUri?: string | null): boolean {
  if (!fileUri) return false;
  try {
    const file = new File(fileUri);
    return file.exists;
  } catch {
    return false;
  }
}
