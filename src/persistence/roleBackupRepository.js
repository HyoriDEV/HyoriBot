import fs from 'fs';
import path from 'path';
import { getEnv } from '../config/env.js';
import { logger } from '../logger/index.js';
export class RoleBackupRepository {
  constructor(customFilePath) {
    if (customFilePath) {
      this.filePath = customFilePath;
    } else {
      const env = getEnv();
      this.filePath = path.join(env.DATA_DIR, 'role_backups.json');
    }
    this.isInitialized = false;
  }
  async init() {
    if (this.isInitialized) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {
          recursive: true,
        });
      }
      if (!fs.existsSync(this.filePath)) {
        const initialData = {
          version: 1,
          lastUpdated: new Date().toISOString(),
          backups: [],
        };
        await this.writeStore(initialData);
        logger.info(
          {
            filePath: this.filePath,
          },
          'Initialized role backup storage file'
        );
      }
      this.isInitialized = true;
    } catch (error) {
      logger.error(
        {
          error,
          filePath: this.filePath,
        },
        'Failed to initialize role backup repository'
      );
      throw error;
    }
  }
  async readStore() {
    await this.init();
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.backups)) {
        data.backups = [];
      }
      return data;
    } catch (error) {
      logger.error(
        {
          error,
          filePath: this.filePath,
        },
        'Error reading role backup file, returning empty state'
      );
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        backups: [],
      };
    }
  }
  async writeStore(data) {
    data.lastUpdated = new Date().toISOString();
    const tempPath = `${this.filePath}.tmp.${Date.now()}`;
    const json = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tempPath, json, 'utf-8');
    await fs.promises.rename(tempPath, this.filePath);
  }
  async createBackup({
    discordId,
    guildId,
    roleIds,
    sanctionType,
    reason,
    expiresAt = null,
    metadata = {},
  }) {
    const store = await this.readStore();
    store.backups.forEach(b => {
      if (b.discordId === discordId && b.status === 'ACTIVE') {
        b.status = 'ARCHIVED';
      }
    });
    const newBackup = {
      id: `bk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      discordId,
      guildId,
      roleIds: Array.isArray(roleIds) ? roleIds : [],
      sanctionType,
      reason,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt || null,
      restoredAt: null,
      status: 'ACTIVE',
      metadata,
    };
    store.backups.push(newBackup);
    await this.writeStore(store);
    logger.info(
      {
        backupId: newBackup.id,
        discordId: newBackup.discordId,
        sanctionType: newBackup.sanctionType,
        rolesCount: newBackup.roleIds.length,
        expiresAt: newBackup.expiresAt,
      },
      'Created role backup for sanctioned member'
    );
    return newBackup;
  }
  async getActiveBackup(discordId) {
    const store = await this.readStore();
    const active = store.backups
      .filter(b => b.discordId === discordId && b.status === 'ACTIVE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return active[0] || null;
  }
  async getBackupById(id) {
    const store = await this.readStore();
    return store.backups.find(b => b.id === id) || null;
  }
  async markAsRestored(backupId, restoredRoleIds = [], missingRoleIds = []) {
    const store = await this.readStore();
    const backup = store.backups.find(b => b.id === backupId);
    if (!backup) {
      return null;
    }
    backup.status = 'RESTORED';
    backup.restoredAt = new Date().toISOString();
    backup.restoredRoleIds = restoredRoleIds;
    backup.missingRoleIds = missingRoleIds;
    await this.writeStore(store);
    logger.info(
      {
        backupId,
        discordId: backup.discordId,
        restoredCount: restoredRoleIds.length,
        missingCount: missingRoleIds.length,
      },
      'Marked role backup as restored and archived'
    );
    return backup;
  }
  async getExpiredActiveBackups(referenceDate = new Date()) {
    const store = await this.readStore();
    const refTime = referenceDate.getTime();
    return store.backups.filter(b => {
      if (b.status !== 'ACTIVE' || !b.expiresAt) return false;
      return new Date(b.expiresAt).getTime() <= refTime;
    });
  }
  async listBackups(filter = {}) {
    const store = await this.readStore();
    let result = store.backups;
    if (filter.discordId) {
      result = result.filter(b => b.discordId === filter.discordId);
    }
    if (filter.status) {
      result = result.filter(b => b.status === filter.status);
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
export const roleBackupRepository = new RoleBackupRepository();
