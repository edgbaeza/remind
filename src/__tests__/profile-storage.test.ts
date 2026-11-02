import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_PROFILE,
  PROFILE_STORAGE_KEY,
  ProfileStorageError,
  getStoredProfile,
  sanitizeProfileName,
  saveStoredProfile,
} from '../services/profile-storage.ts';
import type { ProfileStorageAdapter } from '../services/profile-storage.ts';

class MockStorageAdapter implements ProfileStorageAdapter {
  private store: Map<string, string> = new Map();
  public shouldFailRead = false;
  public shouldFailWrite = false;
  public setItemCallCount = 0;

  async getItem(key: string): Promise<string | null> {
    if (this.shouldFailRead) {
      throw new Error('Simulated read I/O error');
    }
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.setItemCallCount++;
    if (this.shouldFailWrite) {
      throw new Error('Simulated write I/O error');
    }
    this.store.set(key, value);
  }
}

describe('Pruebas unitarias de Perfil de Usuario (profile-storage)', () => {
  describe('1. Validación y sanitización de nombres', () => {
    it('Limpia espacios en blanco al inicio y al final', () => {
      assert.equal(sanitizeProfileName('   Carlos Baeza   '), 'Carlos Baeza');
    });

    it('Rechaza nombres vacíos o que solo contienen espacios', () => {
      assert.throws(
        () => sanitizeProfileName(''),
        (err) => err instanceof ProfileStorageError && err.message.includes('no puede estar vacío')
      );
      assert.throws(
        () => sanitizeProfileName('    '),
        (err) => err instanceof ProfileStorageError && err.message.includes('no puede estar vacío')
      );
    });

    it('Trunca nombres excesivamente largos a 50 caracteres', () => {
      const longName = 'A'.repeat(60);
      const sanitized = sanitizeProfileName(longName);
      assert.equal(sanitized.length, 50);
    });
  });

  describe('2. Lectura de perfil (getStoredProfile)', () => {
    it('Retorna perfil predeterminado si no hay datos guardados', async () => {
      const adapter = new MockStorageAdapter();
      const profile = await getStoredProfile(adapter);
      assert.deepEqual(profile, DEFAULT_PROFILE);
      assert.equal(profile.name, 'Mi perfil');
      assert.equal(profile.avatarType, 'default');
      assert.equal(profile.avatarUri, undefined);
    });

    it('Lanza ProfileStorageError si hay fallo de lectura de hardware', async () => {
      const adapter = new MockStorageAdapter();
      adapter.shouldFailRead = true;

      await assert.rejects(
        async () => await getStoredProfile(adapter),
        (err) => err instanceof ProfileStorageError
      );
    });

    it('Lanza ProfileStorageError ante JSON corrupto', async () => {
      const adapter = new MockStorageAdapter();
      await adapter.setItem(PROFILE_STORAGE_KEY, '{ broken json !!');

      await assert.rejects(
        async () => await getStoredProfile(adapter),
        (err) => err instanceof ProfileStorageError
      );
    });

    it('Recupera perfil guardado con avatar predeterminado', async () => {
      const adapter = new MockStorageAdapter();
      await adapter.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({ name: 'Elena Gómez', avatarType: 'default' })
      );

      const profile = await getStoredProfile(adapter);
      assert.equal(profile.name, 'Elena Gómez');
      assert.equal(profile.avatarType, 'default');
      assert.equal(profile.avatarUri, undefined);
    });

    it('Recupera perfil guardado con foto personalizada', async () => {
      const adapter = new MockStorageAdapter();
      await adapter.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          name: 'Elena Gómez',
          avatarType: 'custom',
          avatarUri: 'file:///data/user/0/com.remind.app/files/profile-photos/my-photo.jpg',
        })
      );

      const profile = await getStoredProfile(adapter);
      assert.equal(profile.name, 'Elena Gómez');
      assert.equal(profile.avatarType, 'custom');
      assert.equal(
        profile.avatarUri,
        'file:///data/user/0/com.remind.app/files/profile-photos/my-photo.jpg'
      );
    });

    it('Degrada de forma segura a default si avatarType es custom pero falta avatarUri', async () => {
      const adapter = new MockStorageAdapter();
      await adapter.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({ name: 'Carlos', avatarType: 'custom', avatarUri: '' })
      );

      const profile = await getStoredProfile(adapter);
      assert.equal(profile.name, 'Carlos');
      assert.equal(profile.avatarType, 'default');
      assert.equal(profile.avatarUri, undefined);
    });
  });

  describe('3. Escritura y actualización de perfil (saveStoredProfile)', () => {
    it('Guarda el nombre sanitizado en almacenamiento inicial vacío usando valores por defecto para el avatar', async () => {
      const adapter = new MockStorageAdapter();
      const saved = await saveStoredProfile({ name: '  Roberto  ' }, adapter);

      assert.equal(saved.name, 'Roberto');
      assert.equal(saved.avatarType, 'default');
      assert.equal(saved.avatarUri, undefined);
      assert.ok(saved.updatedAt);

      const retrieved = await getStoredProfile(adapter);
      assert.equal(retrieved.name, 'Roberto');
      assert.equal(retrieved.avatarType, 'default');
    });

    it('Rechaza guardar nombre vacío sin alterar almacenamiento', async () => {
      const adapter = new MockStorageAdapter();
      await assert.rejects(
        async () => await saveStoredProfile({ name: '   ' }, adapter),
        (err) => err instanceof ProfileStorageError
      );

      const retrieved = await getStoredProfile(adapter);
      assert.equal(retrieved.name, DEFAULT_PROFILE.name);
    });

    it('Guarda fotografía de perfil personalizada conservando el nombre existente', async () => {
      const adapter = new MockStorageAdapter();
      await saveStoredProfile({ name: 'Sofía' }, adapter);

      const photoUri = 'file:///data/user/0/com.remind.app/files/profile-photos/profile_123.jpg';
      const updated = await saveStoredProfile(
        { avatarType: 'custom', avatarUri: photoUri },
        adapter
      );

      assert.equal(updated.name, 'Sofía');
      assert.equal(updated.avatarType, 'custom');
      assert.equal(updated.avatarUri, photoUri);

      const retrieved = await getStoredProfile(adapter);
      assert.equal(retrieved.name, 'Sofía');
      assert.equal(retrieved.avatarType, 'custom');
      assert.equal(retrieved.avatarUri, photoUri);
    });

    it('Actualiza nombre sin alterar la fotografía personalizada existente', async () => {
      const adapter = new MockStorageAdapter();
      const photoUri = 'file:///data/user/0/com.remind.app/files/profile-photos/profile_123.jpg';
      await saveStoredProfile(
        { name: 'Sofía', avatarType: 'custom', avatarUri: photoUri },
        adapter
      );

      const updated = await saveStoredProfile({ name: 'Sofía Martínez' }, adapter);
      assert.equal(updated.name, 'Sofía Martínez');
      assert.equal(updated.avatarType, 'custom');
      assert.equal(updated.avatarUri, photoUri);
    });

    it('Restaura avatar predeterminado limpiando la referencia de URI', async () => {
      const adapter = new MockStorageAdapter();
      const photoUri = 'file:///data/user/0/com.remind.app/files/profile-photos/profile_123.jpg';
      await saveStoredProfile(
        { name: 'Diego', avatarType: 'custom', avatarUri: photoUri },
        adapter
      );

      const restored = await saveStoredProfile(
        { avatarType: 'default', avatarUri: null },
        adapter
      );

      assert.equal(restored.name, 'Diego');
      assert.equal(restored.avatarType, 'default');
      assert.equal(restored.avatarUri, undefined);

      const retrieved = await getStoredProfile(adapter);
      assert.equal(retrieved.avatarType, 'default');
      assert.equal(retrieved.avatarUri, undefined);
    });

    it('Detiene el guardado y NO ejecuta escritura si falla la lectura previa', async () => {
      const adapter = new MockStorageAdapter();
      // Guardar un perfil válido existente
      await saveStoredProfile(
        {
          name: 'Usuario Previo',
          avatarType: 'custom',
          avatarUri: 'file:///photo.jpg',
        },
        adapter
      );

      adapter.setItemCallCount = 0; // Resetear contador de escrituras
      adapter.shouldFailRead = true; // Activar fallo simulado de lectura I/O

      // El intento de guardar debe fallar y propagar ProfileStorageError
      await assert.rejects(
        async () => await saveStoredProfile({ name: 'Nombre Modificado' }, adapter),
        (err) => err instanceof ProfileStorageError
      );

      // Verificar que NO se ejecutó ninguna llamada a setItem
      assert.equal(adapter.setItemCallCount, 0);

      // Restaurar lectura y confirmar que los datos almacenados nunca se sobrescribieron
      adapter.shouldFailRead = false;
      const intact = await getStoredProfile(adapter);
      assert.equal(intact.name, 'Usuario Previo');
      assert.equal(intact.avatarType, 'custom');
      assert.equal(intact.avatarUri, 'file:///photo.jpg');
    });

    it('Detiene el guardado y NO ejecuta escritura si el perfil guardado tiene JSON corrupto', async () => {
      const adapter = new MockStorageAdapter();
      await adapter.setItem(PROFILE_STORAGE_KEY, '{ json_invalido: ');
      adapter.setItemCallCount = 0;

      await assert.rejects(
        async () => await saveStoredProfile({ name: 'Nuevo Nombre' }, adapter),
        (err) => err instanceof ProfileStorageError
      );

      assert.equal(adapter.setItemCallCount, 0);
    });

    it('Lanza ProfileStorageError si falla la escritura', async () => {
      const adapter = new MockStorageAdapter();
      adapter.shouldFailWrite = true;

      await assert.rejects(
        async () => await saveStoredProfile({ name: 'Ana' }, adapter),
        (err) => err instanceof ProfileStorageError
      );
    });
  });
});
