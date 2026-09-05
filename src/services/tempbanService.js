import { ChannelType, PermissionsBitField } from 'discord.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

export class TempbanService {
  /**
   * Récupère la configuration actuelle du tempban
   */
  static async getConfig() {
    const config = await configStore.read().catch(() => ({}));
    const tempban = config.tempban || {};
    return {
      roleId: tempban.roleId || config.roles?.mutedRoleId || null,
      allowedChannels: tempban.allowedChannels || [],
      lastSyncedAt: tempban.lastSyncedAt || null
    };
  }

  /**
   * Enregistre le rôle et/ou les salons autorisés
   */
  static async saveConfig({ roleId, allowedChannels, lastSyncedAt }) {
    return await configStore.update(data => {
      data.tempban = data.tempban || {};
      if (roleId !== undefined) {
        data.tempban.roleId = roleId;
        data.roles = data.roles || {};
        data.roles.mutedRoleId = roleId;
      }
      if (allowedChannels !== undefined) {
        data.tempban.allowedChannels = allowedChannels;
      }
      if (lastSyncedAt !== undefined) {
        data.tempban.lastSyncedAt = lastSyncedAt;
      }
      return data;
    });
  }

  /**
   * Récupère ou crée le rôle Tempban / Isolement sur le serveur
   * @param {import('discord.js').Guild} guild
   */
  static async getOrCreateTempbanRole(guild) {
    const cfg = await this.getConfig();
    let role = null;

    if (cfg.roleId) {
      role = guild.roles.cache.get(cfg.roleId) ||
             await guild.roles.fetch(cfg.roleId).catch(() => null);
    }

    if (!role) {
      role = guild.roles.cache.find(r => r.name === 'Tempban' || r.name === 'Muted-Restricted');
    }

    if (!role) {
      logger.info({ guildId: guild.id }, 'Création du rôle Tempban sur le serveur');
      role = await guild.roles.create({
        name: 'Tempban',
        color: '#4f545c',
        reason: 'Rôle d\'isolement pour le système de tempban'
      });

      await this.saveConfig({ roleId: role.id });
    }

    return role;
  }

  /**
   * Applique les permissions sur l'ensemble des salons du serveur :
   * - Salons autorisés : ViewChannel = true, SendMessages = true, ReadMessageHistory = true
   * - Salons masqués (tous les autres) : ViewChannel = false
   * @param {import('discord.js').Guild} guild
   * @param {string} roleId
   * @param {string[]} allowedChannelIds
   */
  static async applyPermissions(guild, roleId, allowedChannelIds = []) {
    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!role) {
      throw new Error('Le rôle configuré est introuvable sur le serveur Discord.');
    }

    const channels = await guild.channels.fetch();
    let allowedCount = 0;
    let hiddenCount = 0;

    for (const [, channel] of channels) {
      if (!channel || channel.isThread?.()) continue;

      const isAllowed = allowedChannelIds.includes(channel.id);
      try {
        if (isAllowed) {
          // Salon visible par le rôle sanctionné (ex: salon d'isolement/ticket/tribunal)
          await channel.permissionOverwrites.edit(role, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AddReactions: true,
            Connect: true,
            Speak: true
          }, { reason: 'Configuration Tempban: Salon autorisé d\'accès' });
          allowedCount++;
        } else {
          // Salon interdit et totalement masqué
          await channel.permissionOverwrites.edit(role, {
            ViewChannel: false,
            Connect: false
          }, { reason: 'Configuration Tempban: Salon masqué et verrouillé' });
          hiddenCount++;
        }
      } catch (err) {
        logger.warn(
          { channelId: channel.id, roleId, error: err.message },
          'Erreur permission salon tempban'
        );
      }
    }

    await this.saveConfig({ lastSyncedAt: Date.now() });

    return {
      total: allowedCount + hiddenCount,
      allowedCount,
      hiddenCount
    };
  }
}
