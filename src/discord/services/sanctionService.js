import { discordBot } from '../client.js';
import { roleBackupRepository } from '../../persistence/roleBackupRepository.js';
import { discordQueue } from '../../queue/discordQueue.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../logger/index.js';
export class SanctionService {
  async applySanction({ discordId, type, reason, durationSeconds = null, metadata = {} }) {
    const env = getEnv();
    return discordQueue.enqueue(`applySanction:${discordId}`, async () => {
      try {
        const guild = await discordBot.fetchGuild();
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          logger.warn(
            {
              discordId,
            },
            'Guild member not found when applying sanction'
          );
          return {
            success: false,
            error: `Member with Discord ID ${discordId} not found in the guild`,
          };
        }
        if (!member.manageable && member.id !== guild.ownerId) {
          logger.warn(
            {
              discordId,
              memberTag: member.user.tag,
            },
            'Member has higher role hierarchy than the bot, roles cannot be modified directly'
          );
        }
        let currentRoleIds = member.roles.cache
          .filter(
            role => role.id !== guild.id && !role.managed && role.id !== env.ROLE_SANCTIONED_ID
          )
          .map(role => role.id);
        const existingActiveBackup = await roleBackupRepository.getActiveBackup(discordId);
        if (
          existingActiveBackup &&
          existingActiveBackup.roleIds.length > 0 &&
          currentRoleIds.length === 0
        ) {
          logger.info(
            {
              discordId,
              existingBackupId: existingActiveBackup.id,
            },
            'Member is already sanctioned, preserving original pre-sanction role backup'
          );
          currentRoleIds = existingActiveBackup.roleIds;
        }
        let expiresAt = null;
        if (durationSeconds && typeof durationSeconds === 'number' && durationSeconds > 0) {
          expiresAt = new Date(Date.now() + durationSeconds * 1000);
        }
        const backup = await roleBackupRepository.createBackup({
          discordId,
          guildId: guild.id,
          roleIds: currentRoleIds,
          sanctionType: type,
          reason,
          expiresAt,
          metadata,
        });
        const rolesToRemove = member.roles.cache
          .filter(
            role => role.id !== guild.id && !role.managed && role.id !== env.ROLE_SANCTIONED_ID
          )
          .map(role => role.id);
        if (rolesToRemove.length > 0 && member.manageable) {
          await member.roles
            .remove(rolesToRemove, `Sanction appliquée: ${type} - ${reason}`)
            .catch(err => {
              logger.warn(
                {
                  discordId,
                  error: err?.message,
                },
                'Could not remove some roles due to hierarchy permissions'
              );
            });
          logger.info(
            {
              discordId,
              removedCount: rolesToRemove.length,
              roleIds: rolesToRemove,
            },
            'Removed current roles from sanctioned member'
          );
        }
        const sanctionedRole =
          guild.roles.cache.get(env.ROLE_SANCTIONED_ID) ||
          (await guild.roles.fetch(env.ROLE_SANCTIONED_ID).catch(() => null));
        if (!sanctionedRole) {
          logger.error(
            {
              roleSanctionedId: env.ROLE_SANCTIONED_ID,
            },
            'Sanctioned role not found in Discord guild configuration'
          );
          return {
            success: false,
            backupId: backup.id,
            error: `Configured ROLE_SANCTIONED_ID (${env.ROLE_SANCTIONED_ID}) not found in guild`,
          };
        }
        if (member.manageable && !member.roles.cache.has(env.ROLE_SANCTIONED_ID)) {
          await member.roles
            .add(sanctionedRole, `Sanction appliquée: ${type} - ${reason}`)
            .catch(err => {
              logger.warn(
                {
                  discordId,
                  error: err?.message,
                },
                'Could not add sanctioned role due to hierarchy permissions'
              );
            });
        }
        logger.info(
          {
            discordId,
            backupId: backup.id,
            sanctionType: type,
            expiresAt: backup.expiresAt,
          },
          'Sanction applied successfully with role backup'
        );
        return {
          success: true,
          backupId: backup.id,
          sanctionType: type,
          removedRoleIds: currentRoleIds,
          assignedRoleId: env.ROLE_SANCTIONED_ID,
          expiresAt: backup.expiresAt,
          message: 'Sanction applied and roles backed up successfully',
        };
      } catch (error) {
        logger.error(
          {
            discordId,
            type,
            error,
          },
          'Error applying sanction to member'
        );
        return {
          success: false,
          error: error?.message || 'Failed to apply sanction',
        };
      }
    });
  }
  async rollbackSanction({ discordId, backupId = null, reason = 'Levée de sanction' }) {
    const env = getEnv();
    return discordQueue.enqueue(`rollbackSanction:${discordId}`, async () => {
      try {
        let backup = null;
        if (backupId) {
          backup = await roleBackupRepository.getBackupById(backupId);
        } else {
          backup = await roleBackupRepository.getActiveBackup(discordId);
        }
        if (!backup) {
          logger.warn(
            {
              discordId,
              backupId,
            },
            'No active role backup found for rollback'
          );
          return {
            success: false,
            error: `No active role backup found for user ${discordId}`,
          };
        }
        const guild = await discordBot.fetchGuild();
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          logger.warn(
            {
              discordId,
            },
            'Guild member not found in Discord server during rollback'
          );
          await roleBackupRepository.markAsRestored(backup.id, [], backup.roleIds);
          return {
            success: true,
            backupId: backup.id,
            memberLeft: true,
            message: 'User is not currently in the Discord server. Backup archived.',
          };
        }
        if (member.roles.cache.has(env.ROLE_SANCTIONED_ID)) {
          await member.roles.remove(env.ROLE_SANCTIONED_ID, `Levée de sanction: ${reason}`);
          logger.info(
            {
              discordId,
              roleId: env.ROLE_SANCTIONED_ID,
            },
            'Removed sanctioned role from member'
          );
        }
        const validRolesToRestore = [];
        const missingRoleIds = [];
        for (const roleId of backup.roleIds) {
          const guildRole =
            guild.roles.cache.get(roleId) || (await guild.roles.fetch(roleId).catch(() => null));
          if (guildRole) {
            validRolesToRestore.push(roleId);
          } else {
            logger.warn(
              {
                discordId,
                roleId,
                backupId: backup.id,
              },
              'Saved role no longer exists on Discord server, skipping role restoration'
            );
            missingRoleIds.push(roleId);
          }
        }
        if (validRolesToRestore.length > 0) {
          await member.roles.add(validRolesToRestore, `Restauration des rôles: ${reason}`);
          logger.info(
            {
              discordId,
              restoredCount: validRolesToRestore.length,
              restoredRoleIds: validRolesToRestore,
            },
            'Restored roles to member successfully'
          );
        }
        await roleBackupRepository.markAsRestored(backup.id, validRolesToRestore, missingRoleIds);
        return {
          success: true,
          backupId: backup.id,
          restoredRoleIds: validRolesToRestore,
          missingRoleIds,
          message: 'Sanction lifted and roles restored successfully',
        };
      } catch (error) {
        logger.error(
          {
            discordId,
            backupId,
            error,
          },
          'Error rolling back sanction'
        );
        return {
          success: false,
          error: error?.message || 'Failed to rollback sanction',
        };
      }
    });
  }
}
export const sanctionService = new SanctionService();
