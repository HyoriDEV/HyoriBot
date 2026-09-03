import { discordBot } from '../client.js';
import { discordQueue } from '../../queue/discordQueue.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../logger/index.js';
export class RoleSyncService {
  getClassRoleMap() {
    const env = getEnv();
    return {
      NOBLE: env.ROLE_NOBLE_ID,
      ROLE_NOBLE: env.ROLE_NOBLE_ID,
      PAYSAN: env.ROLE_PAYSAN_ID,
      ROLE_PAYSAN: env.ROLE_PAYSAN_ID,
      PECHEUR: env.ROLE_PECHEUR_ID,
      ROLE_PECHEUR: env.ROLE_PECHEUR_ID,
      MINEUR: env.ROLE_MINEUR_ID,
      ROLE_MINEUR: env.ROLE_MINEUR_ID,
      ERUDIT: env.ROLE_ERUDIT_ID,
      ROLE_ERUDIT: env.ROLE_ERUDIT_ID,
    };
  }
  getAllClassRoleIds() {
    const env = getEnv();
    return [
      env.ROLE_NOBLE_ID,
      env.ROLE_PAYSAN_ID,
      env.ROLE_PECHEUR_ID,
      env.ROLE_MINEUR_ID,
      env.ROLE_ERUDIT_ID,
    ];
  }
  getStaffRoleMap() {
    const env = getEnv();
    return {
      GC: env.ROLE_GC_ID,
      ROLE_GC: env.ROLE_GC_ID,
      CONFLICT_MANAGEMENT: env.ROLE_GC_ID,
      COMMUNICATION: env.ROLE_COMMUNICATION_ID,
      ROLE_COMMUNICATION: env.ROLE_COMMUNICATION_ID,
      RP_TRACKING: env.ROLE_RP_TRACKING_ID,
      ROLE_RP_TRACKING: env.ROLE_RP_TRACKING_ID,
      EVENT: env.ROLE_EVENT_ID,
      ROLE_EVENT: env.ROLE_EVENT_ID,
      DEVELOPER: env.ROLE_DEVELOPER_ID,
      ROLE_DEVELOPER: env.ROLE_DEVELOPER_ID,
      ADMIN: env.ROLE_ADMIN_ID,
      ROLE_ADMIN: env.ROLE_ADMIN_ID,
    };
  }
  getAllStaffRoleIds() {
    const env = getEnv();
    return [
      env.ROLE_GC_ID,
      env.ROLE_COMMUNICATION_ID,
      env.ROLE_RP_TRACKING_ID,
      env.ROLE_EVENT_ID,
      env.ROLE_DEVELOPER_ID,
      env.ROLE_ADMIN_ID,
    ];
  }
  async syncWhitelistAndClass({ discordId, whitelisted, classRole }) {
    const env = getEnv();
    const classMap = this.getClassRoleMap();
    const allClasses = this.getAllClassRoleIds();
    return discordQueue.enqueue(`syncWhitelistAndClass:${discordId}`, async () => {
      try {
        const guild = await discordBot.fetchGuild();
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          logger.warn(
            {
              discordId,
            },
            'Guild member not found for Whitelist & Class sync'
          );
          return {
            success: false,
            error: `Member with Discord ID ${discordId} not found in guild`,
          };
        }
        const rolesToAdd = [];
        const rolesToRemove = [];
        const targetClassRoleId = classRole ? classMap[classRole.toUpperCase()] : null;
        if (whitelisted) {
          rolesToAdd.push(env.ROLE_WHITELIST_ID);
          if (targetClassRoleId) {
            rolesToAdd.push(targetClassRoleId);
          }
          allClasses.forEach(roleId => {
            if (roleId !== targetClassRoleId && member.roles.cache.has(roleId)) {
              rolesToRemove.push(roleId);
            }
          });
        } else {
          if (member.roles.cache.has(env.ROLE_WHITELIST_ID)) {
            rolesToRemove.push(env.ROLE_WHITELIST_ID);
          }
          allClasses.forEach(roleId => {
            if (member.roles.cache.has(roleId)) {
              rolesToRemove.push(roleId);
            }
          });
        }
        if (rolesToRemove.length > 0) {
          await member.roles
            .remove(rolesToRemove, 'Synchronisation Whitelist/Classe RP')
            .catch(err => {
              logger.warn(
                {
                  discordId,
                  error: err?.message,
                },
                'Failed to remove some roles (hierarchy check)'
              );
            });
          logger.info(
            {
              discordId,
              rolesToRemove,
            },
            'Removed obsolete Whitelist/Class roles'
          );
        }
        if (rolesToAdd.length > 0) {
          await member.roles.add(rolesToAdd, 'Synchronisation Whitelist/Classe RP').catch(err => {
            logger.warn(
              {
                discordId,
                error: err?.message,
              },
              'Failed to add some roles (hierarchy check)'
            );
          });
          logger.info(
            {
              discordId,
              rolesToAdd,
            },
            'Assigned Whitelist/Class roles'
          );
        }
        return {
          success: true,
          whitelisted,
          classRole: classRole || null,
          rolesAdded: rolesToAdd,
          rolesRemoved: rolesToRemove,
          message: 'Whitelist and RP class synchronized successfully',
        };
      } catch (error) {
        logger.error(
          {
            discordId,
            whitelisted,
            classRole,
            error,
          },
          'Error syncing Whitelist and Class roles'
        );
        return {
          success: false,
          error: error?.message || 'Failed to synchronize Whitelist/Class roles',
        };
      }
    });
  }
  async syncStaffRole({ discordId, staffRole }) {
    const staffMap = this.getStaffRoleMap();
    const allStaffRoleIds = this.getAllStaffRoleIds();
    return discordQueue.enqueue(`syncStaffRole:${discordId}`, async () => {
      try {
        const guild = await discordBot.fetchGuild();
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) {
          logger.warn(
            {
              discordId,
            },
            'Guild member not found for Staff role sync'
          );
          return {
            success: false,
            error: `Member with Discord ID ${discordId} not found in guild`,
          };
        }
        let targetStaffRoleId = null;
        if (staffRole && staffRole !== 'NONE' && staffRole !== 'PLAYER') {
          targetStaffRoleId = staffMap[staffRole.toUpperCase()] || null;
          if (!targetStaffRoleId) {
            logger.warn(
              {
                staffRole,
              },
              'Unknown staff role specified, removing staff privileges'
            );
          }
        }
        const rolesToRemove = [];
        const rolesToAdd = [];
        allStaffRoleIds.forEach(roleId => {
          if (roleId !== targetStaffRoleId && member.roles.cache.has(roleId)) {
            rolesToRemove.push(roleId);
          }
        });
        if (targetStaffRoleId && !member.roles.cache.has(targetStaffRoleId)) {
          rolesToAdd.push(targetStaffRoleId);
        }
        if (rolesToRemove.length > 0) {
          await member.roles
            .remove(rolesToRemove, 'Mise à jour rôle Staff (règle non-cumul)')
            .catch(err => {
              logger.warn(
                {
                  discordId,
                  error: err?.message,
                },
                'Failed to remove old staff roles (hierarchy check)'
              );
            });
          logger.info(
            {
              discordId,
              rolesToRemove,
            },
            'Removed previous staff roles'
          );
        }
        if (rolesToAdd.length > 0) {
          await member.roles.add(rolesToAdd, 'Attribution rôle Staff').catch(err => {
            logger.warn(
              {
                discordId,
                error: err?.message,
              },
              'Failed to add staff role (hierarchy check)'
            );
          });
          logger.info(
            {
              discordId,
              rolesToAdd,
            },
            'Assigned new staff role'
          );
        }
        return {
          success: true,
          staffRole: staffRole || null,
          targetStaffRoleId,
          rolesAdded: rolesToAdd,
          rolesRemoved: rolesToRemove,
          message: 'Staff role synchronized successfully (single role constraint respected)',
        };
      } catch (error) {
        logger.error(
          {
            discordId,
            staffRole,
            error,
          },
          'Error syncing Staff role'
        );
        return {
          success: false,
          error: error?.message || 'Failed to synchronize Staff role',
        };
      }
    });
  }
}
export const roleSyncService = new RoleSyncService();
