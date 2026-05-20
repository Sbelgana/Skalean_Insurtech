/**
 * @insurtech/auth/services/pepper
 *
 * Manages the server-side pepper used in password hashing.
 * Supports versioned pepper for graceful rotation (Sprint 14+).
 *
 * Reads PASSWORD_PEPPER (and optional PASSWORD_PEPPER_V2) directly from process.env
 * to align with the project-wide convention of @insurtech/shared-config loadEnv().
 *
 * Reference :
 *   - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#peppering
 *   - decision-013 (Argon2id with pepper)
 */

import { Injectable, Logger } from '@nestjs/common';

const MIN_PEPPER_LENGTH = 32;

@Injectable()
export class PepperService {
  private readonly logger = new Logger(PepperService.name);
  private readonly currentVersion: number;
  private readonly peppers: ReadonlyMap<number, string>;

  constructor() {
    const pepperV1 = process.env['PASSWORD_PEPPER'];
    if (!pepperV1) {
      throw new Error('PepperService: PASSWORD_PEPPER env var is required');
    }
    if (pepperV1.length < MIN_PEPPER_LENGTH) {
      throw new Error(
        `PepperService: PASSWORD_PEPPER must be at least ${MIN_PEPPER_LENGTH} chars (got ${pepperV1.length}). Generate with: openssl rand -base64 48.`,
      );
    }

    const versionRaw = process.env['PASSWORD_PEPPER_VERSION'] ?? '1';
    const version = Number.parseInt(versionRaw, 10);
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(
        `PepperService: PASSWORD_PEPPER_VERSION must be a positive integer, got '${versionRaw}'`,
      );
    }

    const map = new Map<number, string>();
    map.set(1, pepperV1);

    const pepperV2 = process.env['PASSWORD_PEPPER_V2'];
    if (pepperV2 && pepperV2.length >= MIN_PEPPER_LENGTH) {
      map.set(2, pepperV2);
    }

    if (!map.has(version)) {
      throw new Error(
        `PepperService: PASSWORD_PEPPER_VERSION=${version} but no pepper is configured for that version`,
      );
    }

    this.peppers = map;
    this.currentVersion = version;
    this.logger.log({
      action: 'pepper_loaded',
      current_version: version,
      available_versions: Array.from(map.keys()),
    });
  }

  getCurrentPepper(): string {
    const p = this.peppers.get(this.currentVersion);
    if (!p) {
      throw new Error(`PepperService: no pepper for current version ${this.currentVersion}`);
    }
    return p;
  }

  getCurrentVersion(): number {
    return this.currentVersion;
  }

  getPepperByVersion(version: number): string {
    const p = this.peppers.get(version);
    if (!p) {
      throw new Error(`PepperService: no pepper for version ${version}`);
    }
    return p;
  }

  hasVersion(version: number): boolean {
    return this.peppers.has(version);
  }
}
