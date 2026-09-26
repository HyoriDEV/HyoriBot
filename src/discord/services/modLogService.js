import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { discordConfig } from '../../config/discordConfig.js';
import { createHyoriEmbed } from '../embeds.js';
import { logger } from '../../logger/index.js';
export class ModLogService {
  async getModLogChannel(guild) {
    if (discordConfig.channels.modLogs) {
      const channel = guild.channels.cache.get(discordConfig.channels.modLogs);
      if (channel && channel.isTextBased()) return channel;
    }
    const channelByName = guild.channels.cache.find(
      c =>
        (c.name === 'logs-moderation' || c.name === 'mod-logs' || c.name === 'logs') &&
        c.isTextBased()
    );
    if (channelByName) return channelByName;
    try {
      const created = await guild.channels.create({
        name: 'logs-moderation',
        type: ChannelType.GuildText,
        topic: 'Journal automatique des actions de modération du staff Hyori RP',
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
        reason: 'Création automatique du salon de logs de modération',
      });
      logger.info(
        {
          channelId: created.id,
        },
        'Created #logs-moderation channel automatically'
      );
      return created;
    } catch (err) {
      logger.warn(
        {
          error: err.message,
        },
        'Could not automatically create #logs-moderation channel'
      );
      return null;
    }
  }
  async sendModLog({
    guild,
    action,
    target,
    moderator,
    reason = 'Aucun motif spécifié',
    duration = null,
    extraFields = [],
  }) {
    try {
      const channel = await this.getModLogChannel(guild);
      if (!channel) return;
      const embed = createHyoriEmbed()
        .setTitle(`🛡️ Action de Modération — ${action}`)
        .addFields(
          {
            name: '👤 Membre ciblé',
            value: target
              ? `${target.tag || target.user?.tag || target.username || target.id} (\`${target.id}\`)`
              : 'Inconnu',
            inline: true,
          },
          {
            name: '👮 Modérateur',
            value: moderator
              ? `${moderator.tag || moderator.user?.tag || moderator.username || moderator.id} (\`${moderator.id}\`)`
              : 'Système',
            inline: true,
          }
        );
      if (duration) {
        embed.addFields({
          name: '⏱️ Durée',
          value: duration,
          inline: true,
        });
      }
      embed.addFields({
        name: '📝 Motif',
        value: reason || 'Non précisé',
        inline: false,
      });
      if (extraFields && extraFields.length > 0) {
        embed.addFields(extraFields);
      }
      await channel.send({
        embeds: [embed],
      });
      logger.info(
        {
          action,
          targetId: target?.id,
          moderatorId: moderator?.id,
        },
        'Mod log sent to channel'
      );
    } catch (error) {
      logger.error(
        {
          error,
          action,
        },
        'Failed to send moderation log'
      );
    }
  }
}
export const modLogService = new ModLogService();
