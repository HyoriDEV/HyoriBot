import { PermissionsBitField } from 'discord.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

export class MuteRoleService {
  /**
   * Récupère ou crée le rôle restrictif @Muted-Restricted sur le serveur.
   * @param {import('discord.js').Guild} guild
   * @returns {Promise<import('discord.js').Role>}
   */
  static async getOrCreateMutedRole(guild) {
    const config = await configStore.read();
    let role = null;

    if (config.tempban?.roleId) {
      role = guild.roles.cache.get(config.tempban.roleId) ||
             await guild.roles.fetch(config.tempban.roleId).catch(() => null);
    }

    if (!role && config.roles?.mutedRoleId) {
      role = guild.roles.cache.get(config.roles.mutedRoleId) ||
             await guild.roles.fetch(config.roles.mutedRoleId).catch(() => null);
    }

    if (!role) {
      // Recherche par nom si l'ID a changé
      role = guild.roles.cache.find(r => r.name === 'Muted-Restricted');
    }

    if (!role) {
      logger.info({ guildId: guild.id }, 'Création du rôle restrictif @Muted-Restricted');
      role = await guild.roles.create({
        name: 'Muted-Restricted',
        color: '#4f545c',
        reason: 'Rôle de restriction automatique pour timeout customisé'
      });

      await configStore.update(data => {
        data.roles = data.roles || {};
        data.roles.mutedRoleId = role.id;
        return data;
      });
    }

    return role;
  }

  /**
   * Met à jour les permissions du rôle sur un salon spécifique selon la blacklist.
   * @param {import('discord.js').GuildChannel} channel
   * @param {import('discord.js').Role} role
   * @param {boolean} restrict
   */
  static async updateChannelPermissions(channel, role, restrict = true) {
    try {
      if (restrict) {
        await channel.permissionOverwrites.edit(role, {
          SendMessages: false,
          SendMessagesInThreads: false,
          CreatePublicThreads: false,
          CreatePrivateThreads: false,
          AddReactions: false,
          Speak: false,
          SendVoiceMessages: false
        }, { reason: 'Application de la restriction salon (Blacklist)' });
      } else {
        await channel.permissionOverwrites.delete(role, 'Retrait du salon de la blacklist');
      }
    } catch (error) {
      logger.error(
        { channelId: channel.id, roleId: role.id, error },
        'Erreur lors de la mise à jour des permissions de salon pour le rôle restrictif'
      );
    }
  }

  /**
   * Synchronise l'ensemble des salons blacklistés avec le rôle restrictif.
   * @param {import('discord.js').Guild} guild
   */
  static async syncAllBlacklistedChannels(guild) {
    const config = await configStore.read();
    const blacklisted = config.moderation?.blacklistedChannels || [];
    if (blacklisted.length === 0) return;

    const role = await this.getOrCreateMutedRole(guild);
    for (const channelId of blacklisted) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        await this.updateChannelPermissions(channel, role, true);
      }
    }
  }
}
