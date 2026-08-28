/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VirtualFile } from '../types';

export class VirtualFileSystem {
  private files: Map<string, VirtualFile> = new Map();
  private snapshotHistory: Array<Map<string, VirtualFile>> = [];

  constructor() {
    this.resetToDefaults();
  }

  public resetToDefaults() {
    this.files.clear();

    const defaultFiles: Array<VirtualFile> = [
      {
        path: '/workspace/faultline.config.json',
        name: 'faultline.config.json',
        content: JSON.stringify(
          {
            name: 'production-api',
            version: '2.4.0',
            environment: 'staging',
            cluster: {
              region: 'us-central1',
              replicas: 3,
              healthCheckPath: '/healthz',
              timeoutMs: 5000,
            },
            database: {
              host: 'db.internal.cloud',
              port: 5432,
              name: 'app_prod',
              poolSize: 10,
              ssl: true,
            },
            auth: {
              issuer: 'https://auth.company.internal',
              audience: 'api-gateway',
            },
          },
          null,
          2
        ),
        mode: 0o644, // rw-r--r--
        owner: 'developer',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
      {
        path: '/workspace/schema.sql',
        name: 'schema.sql',
        content: `-- Database Schema Definitions
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) NOT NULL
);
`,
        mode: 0o644,
        owner: 'developer',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
      {
        path: '/workspace/.env.secret',
        name: '.env.secret',
        content: `# Protected Runtime Secrets
DATABASE_URL="postgres://admin:s3cr3t_p@ssw0rd@127.0.0.1:5432/app_prod"
JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"
DEPLOY_TOKEN="fl_live_994821a4f0284b"
`,
        mode: 0o400, // r-------- (Read-only for owner, read-locked to simulate permission check)
        owner: 'root',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
      {
        path: '/workspace/migrations/001_init.sql',
        name: '001_init.sql',
        content: 'CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, action TEXT, created_at TIMESTAMPTZ);',
        mode: 0o644,
        owner: 'developer',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
      {
        path: '/workspace/migrations/002_add_index.sql',
        name: '002_add_index.sql',
        content: 'CREATE INDEX idx_audit_created ON audit_logs(created_at);',
        mode: 0o644,
        owner: 'developer',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
      {
        path: '/workspace/migrations/003_broken_syntax.sql',
        name: '003_broken_syntax.sql',
        content: 'ALTER TABLE orders ADD COLUMN broken_field VARCHAR(20) INVALID_SYNTAX_TRIGGER_FAIL;',
        mode: 0o644,
        owner: 'developer',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
      {
        path: '/workspace/package.json',
        name: 'package.json',
        content: JSON.stringify(
          {
            name: 'target-service',
            scripts: {
              start: 'node index.js',
              build: 'echo "Building service assets..."',
            },
            dependencies: {
              express: '^4.21.2',
            },
          },
          null,
          2
        ),
        mode: 0o644,
        owner: 'developer',
        updatedAt: new Date().toISOString(),
        isDirectory: false,
      },
    ];

    for (const f of defaultFiles) {
      this.files.set(this.normalizePath(f.path), f);
    }
  }

  public normalizePath(rawPath: string): string {
    let p = rawPath.trim();
    if (!p.startsWith('/')) {
      p = '/workspace/' + p;
    }
    // Remove redundant ./ and //
    p = p.replace(/\/\.\//g, '/').replace(/\/+/g, '/');
    return p;
  }

  public exists(path: string): boolean {
    return this.files.has(this.normalizePath(path));
  }

  public readFile(path: string): VirtualFile {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);
    if (!file) {
      const error: any = new Error(`ENOENT: no such file or directory, open '${path}'`);
      error.code = 'ENOENT';
      error.errno = -2;
      error.syscall = 'open';
      error.path = path;
      throw error;
    }

    // Check read permission
    // 0o400 means read only, 0o000 means no permissions
    if ((file.mode & 0o444) === 0) {
      const error: any = new Error(`EACCES: permission denied, read '${path}'`);
      error.code = 'EACCES';
      error.errno = -13;
      error.syscall = 'read';
      error.path = path;
      throw error;
    }

    return file;
  }

  public writeFile(path: string, content: string, mode = 0o644, owner = 'developer'): void {
    const normalized = this.normalizePath(path);
    const existing = this.files.get(normalized);

    if (existing) {
      // Check write permission (0o222)
      if ((existing.mode & 0o222) === 0) {
        const error: any = new Error(`EACCES: permission denied, open '${path}' for writing (mode: 0${existing.mode.toString(8)})`);
        error.code = 'EACCES';
        error.errno = -13;
        error.syscall = 'open';
        error.path = path;
        throw error;
      }
    }

    const fileName = normalized.split('/').filter(Boolean).pop() || 'unnamed';
    this.files.set(normalized, {
      path: normalized,
      name: fileName,
      content,
      mode: existing ? existing.mode : mode,
      owner: existing ? existing.owner : owner,
      updatedAt: new Date().toISOString(),
      isDirectory: false,
    });
  }

  public chmod(path: string, mode: number): void {
    const normalized = this.normalizePath(path);
    const file = this.files.get(normalized);
    if (!file) {
      const error: any = new Error(`ENOENT: cannot access '${path}': No such file or directory`);
      error.code = 'ENOENT';
      throw error;
    }
    file.mode = mode;
    file.updatedAt = new Date().toISOString();
  }

  public removeFile(path: string): void {
    const normalized = this.normalizePath(path);
    if (!this.files.has(normalized)) {
      const error: any = new Error(`ENOENT: cannot remove '${path}': No such file or directory`);
      error.code = 'ENOENT';
      throw error;
    }
    this.files.delete(normalized);
  }

  public listFiles(): VirtualFile[] {
    return Array.from(this.files.values()).sort((a, b) => a.path.localeCompare(b.path));
  }

  public createSnapshot(): number {
    const snapshot = new Map<string, VirtualFile>();
    for (const [k, v] of this.files.entries()) {
      snapshot.set(k, { ...v });
    }
    this.snapshotHistory.push(snapshot);
    return this.snapshotHistory.length - 1;
  }

  public rollbackToLastSnapshot(): boolean {
    if (this.snapshotHistory.length === 0) return false;
    const last = this.snapshotHistory.pop();
    if (!last) return false;
    this.files = last;
    return true;
  }

  public getSnapshotCount(): number {
    return this.snapshotHistory.length;
  }
}

export const vfs = new VirtualFileSystem();
