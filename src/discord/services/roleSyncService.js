import { discordBot } from '../client.js';
import { discordQueue } from '../../queue/discordQueue.js';
import { discordConfig } from '../../config/discordConfig.js';
import { logger } from '../../logger/index.js';

export class RoleSyncService {
  getClassRoleMap() {
    return {
      NOBLE: discordConfig.roles.classes.NOBLE,
      ROLE_NOBLE: discordConfig.roles.classes.NOBLE,
      PAYSAN: discordConfig.roles.classes.PAYSAN,
      ROLE_PAYSAN: discordConfig.roles.classes.PAYSAN,
      PECHEUR: discordConfig.roles.classes.PECHEUR,
      ROLE_PECHEUR: discordConfig.roles.classes.PECHEUR,
      MINEUR: discordConfig.roles.classes.MINEUR,
      ROLE_MINEUR: discordConfig.roles.classes.MINEUR,
      ERUDIT: discordConfig.roles.classes.ERUDIT,
      ROLE_ERUDIT: discordConfig.roles.classes.ERUDIT,
    };
  }
  getAllClassRoleIds() {
    return Object.values(discordConfig.roles.classes);
  }
  getStaffRoleMap() {
    return {
      GC: discordConfig.roles.staff.GC,
      ROLE_GC: discordConfig.roles.staff.GC,
      CONFLICT_MANAGEMENT: discordConfig.roles.staff.GC,
      COMMUNICATION: discordConfig.roles.staff.COMMUNICATION,
      ROLE_COMMUNICATION: discordConfig.roles.staff.COMMUNICATION,
      RP_TRACKING: discordConfig.roles.staff.RP_TRACKING,
      ROLE_RP_TRACKING: discordConfig.roles.staff.RP_TRACKING,
      EVENT: discordConfig.roles.staff.EVENT,
      ROLE_EVENT: discordConfig.roles.staff.EVENT,
      DEVELOPER: discordConfig.roles.staff.DEVELOPER,
      ROLE_DEVELOPER: discordConfig.roles.staff.DEVELOPER,
      ADMIN: discordConfig.roles.staff.ADMIN,
      ROLE_ADMIN: discordConfig.roles.staff.ADMIN,
    };
  }
  getAllStaffRoleIds() {
    return Object.values(discordConfig.roles.staff);
  }
  async syncWhitelistAndClass({ discordId, whitelisted, classRole }) {
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
        const whitelistRoleId = discordConfig.roles.whitelist;
        if (whitelisted) {
          if (whitelistRoleId) {
            rolesToAdd.push(whitelistRoleId);
          }
          if (targetClassRoleId) {
            rolesToAdd.push(targetClassRoleId);
          }
          allClasses.forEach(roleId => {
            if (roleId !== targetClassRoleId && member.roles.cache.has(roleId)) {
              rolesToRemove.push(roleId);
            }
          });
        } else {
          if (whitelistRoleId && member.roles.cache.has(whitelistRoleId)) {
            rolesToRemove.push(whitelistRoleId);
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
