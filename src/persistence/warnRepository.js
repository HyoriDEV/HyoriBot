import fs from 'fs';
import path from 'path';
import { getEnv } from '../config/env.js';
import { logger } from '../logger/index.js';
export class WarnRepository {
  constructor(customFilePath) {
    if (customFilePath) {
      this.filePath = customFilePath;
    } else {
      const env = getEnv();
      this.filePath = path.join(env.DATA_DIR, 'warns.json');
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
          warns: [],
        };
        await this.writeStore(initialData);
        logger.info(
          {
            filePath: this.filePath,
          },
          'Initialized warns storage file'
        );
      }
      this.isInitialized = true;
    } catch (error) {
      logger.error(
        {
          error,
          filePath: this.filePath,
        },
        'Failed to initialize warns repository'
      );
      throw error;
    }
  }
  async readStore() {
    await this.init();
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (!Array.isArray(data.warns)) {
        data.warns = [];
      }
      return data;
    } catch (error) {
      logger.error(
        {
          error,
          filePath: this.filePath,
        },
        'Error reading warns file, returning empty state'
      );
      return {
        version: 1,
        lastUpdated: new Date().toISOString(),
        warns: [],
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
  async addWarn({ discordId, guildId, moderatorId, moderatorTag, reason }) {
    const store = await this.readStore();
    const newWarn = {
      id: `wrn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      discordId,
      guildId,
      moderatorId,
      moderatorTag,
      reason,
      createdAt: new Date().toISOString(),
    };
    store.warns.push(newWarn);
    await this.writeStore(store);
    logger.info(
      {
        warnId: newWarn.id,
        discordId,
        moderatorTag,
        reason,
      },
      'Added warning to member'
    );
    const totalWarns = store.warns.filter(w => w.discordId === discordId).length;
    return {
      warn: newWarn,
      totalWarns,
    };
  }
  async getWarns(discordId) {
    const store = await this.readStore();
    return store.warns
      .filter(w => w.discordId === discordId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
  async clearWarns(discordId) {
    const store = await this.readStore();
    const previousCount = store.warns.filter(w => w.discordId === discordId).length;
    store.warns = store.warns.filter(w => w.discordId !== discordId);
    await this.writeStore(store);
    logger.info(
      {
        discordId,
        deletedCount: previousCount,
      },
      'Cleared member warnings'
    );
    return previousCount;
  }
}
export const warnRepository = new WarnRepository();
