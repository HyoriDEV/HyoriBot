import { roleBackupRepository } from '../persistence/roleBackupRepository.js';
import { sanctionService } from '../discord/services/sanctionService.js';
import { logger } from '../logger/index.js';
export class SuspensionScheduler {
  constructor(intervalMs = 30000) {
    this.intervalMs = intervalMs;
    this.timer = null;
    this.isRunning = false;
    this.isChecking = false;
  }
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(
      {
        intervalMs: this.intervalMs,
      },
      'Suspension expiration scheduler started'
    );
    this.checkExpiredSuspensions().catch(err => {
      logger.error(
        {
          error: err,
        },
        'Error during initial suspension expiration check'
      );
    });
    this.timer = setInterval(() => {
      this.checkExpiredSuspensions().catch(err => {
        logger.error(
          {
            error: err,
          },
          'Error during periodic suspension expiration check'
        );
      });
    }, this.intervalMs);
  }
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('Suspension expiration scheduler stopped');
  }
  async checkExpiredSuspensions() {
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      const now = new Date();
      const expiredBackups = await roleBackupRepository.getExpiredActiveBackups(now);
      if (expiredBackups.length > 0) {
        logger.info(
          {
            count: expiredBackups.length,
          },
          'Found expired suspensions requiring automatic rollback'
        );
        for (const backup of expiredBackups) {
          try {
            logger.info(
              {
                backupId: backup.id,
                discordId: backup.discordId,
                expiresAt: backup.expiresAt,
              },
              'Triggering automatic rollback for expired suspension'
            );
            await sanctionService.rollbackSanction({
              discordId: backup.discordId,
              backupId: backup.id,
              reason: 'Expiration automatique de la durée de suspension',
            });
          } catch (itemError) {
            logger.error(
              {
                backupId: backup.id,
                discordId: backup.discordId,
                error: itemError,
              },
              'Failed to process single expired suspension, marking as archived to prevent loop'
            );
            await roleBackupRepository.markAsRestored(backup.id, [], backup.roleIds);
          }
        }
      }
    } catch (error) {
      logger.error(
        {
          error,
        },
        'Failed to process expired suspensions'
      );
    } finally {
      this.isChecking = false;
    }
  }
}
export const suspensionScheduler = new SuspensionScheduler(30000);
