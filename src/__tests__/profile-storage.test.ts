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

  async getItem(key: string): Promise<string | null> {
    if (this.shouldFailRead) {
      throw new Error('Simulated read I/O error');
    }
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
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

    it('Recupera perfil guardado correctamente', async () => {
      const adapter = new MockStorageAdapter();
      await adapter.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({ name: 'Elena Gómez', avatarType: 'default' })
      );

      const profile = await getStoredProfile(adapter);
      assert.equal(profile.name, 'Elena Gómez');
      assert.equal(profile.avatarType, 'default');
    });
  });

  describe('3. Escritura de perfil (saveStoredProfile)', () => {
    it('Guarda el nombre sanitizado en almacenamiento', async () => {
      const adapter = new MockStorageAdapter();
      const saved = await saveStoredProfile({ name: '  Roberto  ' }, adapter);

      assert.equal(saved.name, 'Roberto');
      assert.ok(saved.updatedAt);

      const retrieved = await getStoredProfile(adapter);
      assert.equal(retrieved.name, 'Roberto');
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
