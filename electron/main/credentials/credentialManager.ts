import { tokenBundleSchema, type TokenBundle } from '@mas/types';
import { Injectable } from '../core/decorators';

// OS-backed encryption seam (electron.safeStorage in production; faked in tests).
export interface SecureEncryptor {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(enc: Buffer): string;
}

// Minimal key/value persistence seam (electron-store in production).
export interface CredentialStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  has(key: string): boolean;
}

const KEY_PREFIX = 'mas.credentials.';

/**
 * Stores OAuth token bundles encrypted at rest. The database only holds a
 * `credentialRef`; the actual token material lives here, encrypted by the OS
 * keychain (DPAPI on Windows, Keychain on macOS) via electron.safeStorage.
 */
@Injectable()
export class CredentialManager {
  constructor(
    private readonly encryptor: SecureEncryptor,
    private readonly store: CredentialStore,
  ) {}

  /** Stable reference key for an account's credential bundle. */
  static refFor(platform: string, externalId: string): string {
    return `${platform}:${externalId}`;
  }

  get available(): boolean {
    return this.encryptor.isEncryptionAvailable();
  }

  save(ref: string, bundle: TokenBundle): void {
    this.assertAvailable();
    const parsed = tokenBundleSchema.parse(bundle);
    const json = JSON.stringify(parsed);
    const encrypted = this.encryptor.encryptString(json).toString('base64');
    this.store.set(KEY_PREFIX + ref, encrypted);
  }

  retrieve(ref: string): TokenBundle | null {
    const stored = this.store.get(KEY_PREFIX + ref);
    if (!stored) return null;
    this.assertAvailable();
    const json = this.encryptor.decryptString(Buffer.from(stored, 'base64'));
    return tokenBundleSchema.parse(JSON.parse(json));
  }

  has(ref: string): boolean {
    return this.store.has(KEY_PREFIX + ref);
  }

  delete(ref: string): void {
    this.store.delete(KEY_PREFIX + ref);
  }

  private assertAvailable(): void {
    if (!this.encryptor.isEncryptionAvailable()) {
      throw new Error(
        'OS secure storage is unavailable; cannot read or write credentials.',
      );
    }
  }
}
