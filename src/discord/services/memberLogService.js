import { ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { getEnv } from '../../config/env.js';
import { createHyoriEmbed } from '../embeds.js';
import { logger } from '../../logger/index.js';

export class MemberLogService {
  /**
   * Finds or creates the member activity log channel
   */
  async getMemberLogChannel(guild) {
    const env = getEnv();

    // 1. Try by configured ID
    if (env.CHANNEL_MEMBER_LOGS_ID) {
      const channel = guild.channels.cache.get(env.CHANNEL_MEMBER_LOGS_ID);
      if (channel && channel.isTextBased()) return channel;
    }

    // 2. Try by common channel names
    const channelByName = guild.channels.cache.find(
      c =>
        (c.name === 'logs-membres' ||
          c.name === 'member-logs' ||
          c.name === 'logs-serveur' ||
          c.name === 'logs-audit') &&
        c.isTextBased()
    );
    if (channelByName) return channelByName;

    // 3. Create #logs-membres automatically with private permissions
    try {
      const created = await guild.channels.create({
        name: 'logs-membres',
        type: ChannelType.GuildText,
        topic: 'Journal automatique des activités des membres (messages, vocal, arrivées/départs)',
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
        ],
        reason: 'Création automatique du salon de logs des membres',
      });

      logger.info({ channelId: created.id }, 'Created #logs-membres channel automatically');
      return created;
    } catch (err) {
      logger.warn({ error: err.message }, 'Could not automatically create #logs-membres channel');
      return null;
    }
  }

  /**
   * Logs deleted message
   */
  async sendDeletedMessageLog({ message }) {
    if (!message || !message.guild) return;

    try {
      const channel = await this.getMemberLogChannel(message.guild);
      if (!channel) return;

      const author = message.author;
      const content = message.content ? message.content.slice(0, 1020) : '*Aucun contenu textuel*';

      const embed = createHyoriEmbed()
        .setTitle('🗑️ Message Supprimé')
        .setColor(0xeb5757) // Red for deletion
        .addFields(
          {
            name: '👤 Auteur',
            value: author ? `${author.tag} (<@${author.id}> — \`${author.id}\`)` : 'Auteur inconnu',
            inline: true,
          },
          {
            name: '💬 Salon',
            value: `<#${message.channel.id}> (\`#${message.channel.name}\`)`,
            inline: true,
          },
          {
            name: '📝 Contenu',
            value: content,
            inline: false,
          }
        );

      if (message.attachments && message.attachments.size > 0) {
        const fileNames = message.attachments
          .map(a => `• [${a.name || 'Fichier'}](${a.url})`)
          .join('\n');
        embed.addFields({
          name: `📎 Pièces jointes (${message.attachments.size})`,
          value: fileNames.slice(0, 1024),
          inline: false,
        });
      }

      await channel.send({ embeds: [embed] });
      logger.debug(
        { authorId: author?.id, channelId: message.channel.id },
        'Deleted message log sent'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to send deleted message log');
    }
  }

  /**
   * Logs edited message
   */
  async sendEditedMessageLog({ oldMessage, newMessage }) {
    if (!newMessage || !newMessage.guild) return;

    try {
      const channel = await this.getMemberLogChannel(newMessage.guild);
      if (!channel) return;

      const author = newMessage.author;
      const oldContent = oldMessage.content
        ? oldMessage.content.slice(0, 1020)
        : '*Non disponible (non mis en cache)*';
      const newContent = newMessage.content
        ? newMessage.content.slice(0, 1020)
        : '*Aucun contenu textuel*';

      const embed = createHyoriEmbed()
        .setTitle('✏️ Message Modifié')
        .setColor(0xf2994a) // Orange for edit
        .addFields(
          {
            name: '👤 Auteur',
            value: author ? `${author.tag} (<@${author.id}> — \`${author.id}\`)` : 'Auteur inconnu',
            inline: true,
          },
          {
            name: '💬 Salon',
            value: `<#${newMessage.channel.id}> (\`#${newMessage.channel.name}\`)`,
            inline: true,
          },
          {
            name: '🔗 Accès direct',
            value: `[Aller au message](${newMessage.url})`,
            inline: true,
          },
          {
            name: '⬅️ Avant',
            value: oldContent,
            inline: false,
          },
          {
            name: '➡️ Après',
            value: newContent,
            inline: false,
          }
        );

      await channel.send({ embeds: [embed] });
      logger.debug(
        { authorId: author?.id, channelId: newMessage.channel.id },
        'Edited message log sent'
      );
    } catch (error) {
      logger.error({ error }, 'Failed to send edited message log');
    }
  }

  /**
   * Logs voice state change (Join, Leave, Move)
   */
  async sendVoiceStateLog({ guild, member, action, oldChannel, newChannel }) {
    if (!guild || !member) return;

    try {
      const channel = await this.getMemberLogChannel(guild);
      if (!channel) return;

      const embed = createHyoriEmbed();

      switch (action) {
        case 'JOIN':
          embed
            .setTitle('🔊 Connexion Vocale')
            .setColor(0x27ae60) // Green
            .addFields(
              {
                name: '👤 Membre',
                value: `${member.user.tag} (<@${member.id}> — \`${member.id}\`)`,
                inline: true,
              },
              {
                name: '🎧 Salon Rejoint',
                value: `<#${newChannel.id}> (\`${newChannel.name}\`)`,
                inline: true,
              }
            );
          break;

        case 'LEAVE':
          embed
            .setTitle('🔇 Déconnexion Vocale')
            .setColor(0xeb5757) // Red
            .addFields(
              {
                name: '👤 Membre',
                value: `${member.user.tag} (<@${member.id}> — \`${member.id}\`)`,
                inline: true,
              },
              {
                name: '🎧 Salon Quitté',
                value: `<#${oldChannel.id}> (\`${oldChannel.name}\`)`,
                inline: true,
              }
            );
          break;

        case 'SWITCH':
          embed
            .setTitle('🔄 Déplacement Vocal')
            .setColor(0x2d9cdb) // Blue
            .addFields(
              {
                name: '👤 Membre',
                value: `${member.user.tag} (<@${member.id}> — \`${member.id}\`)`,
                inline: false,
              },
              {
                name: '⬅️ Ancien Salon',
                value: `<#${oldChannel.id}> (\`${oldChannel.name}\`)`,
                inline: true,
              },
              {
                name: '➡️ Nouveau Salon',
                value: `<#${newChannel.id}> (\`${newChannel.name}\`)`,
                inline: true,
              }
            );
          break;

        default:
          return;
      }

      await channel.send({ embeds: [embed] });
      logger.debug({ memberId: member.id, action }, 'Voice state log sent');
    } catch (error) {
      logger.error({ error, action }, 'Failed to send voice state log');
    }
  }

  /**
   * Logs member join
   */
  async sendMemberJoinLog({ member }) {
    if (!member || !member.guild) return;

    try {
      const channel = await this.getMemberLogChannel(member.guild);
      if (!channel) return;

      const user = member.user;
      const accountCreatedAt = Math.round(user.createdTimestamp / 1000);
      const isRecentAccount = Date.now() - user.createdTimestamp < 7 * 24 * 60 * 60 * 1000;

      const embed = createHyoriEmbed()
        .setTitle("📥 Arrivée d'un Membre")
        .setColor(0x27ae60)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          {
            name: '👤 Membre',
            value: `${user.tag} (<@${user.id}>)`,
            inline: true,
          },
          {
            name: '🆔 Identifiant',
            value: `\`${user.id}\``,
            inline: true,
          },
          {
            name: '📅 Compte créé le',
            value: `<t:${accountCreatedAt}:F> (<t:${accountCreatedAt}:R>)`,
            inline: false,
          },
          {
            name: '👥 Total sur le serveur',
            value: `**${member.guild.memberCount}** membres`,
            inline: true,
          }
        );

      if (isRecentAccount) {
        embed.addFields({
          name: '⚠️ Alerte Compte Récent',
          value: 'Ce compte Discord a été créé il y a **moins de 7 jours**.',
          inline: false,
        });
      }

      await channel.send({ embeds: [embed] });
      logger.info({ memberId: user.id }, 'Member join log sent');
    } catch (error) {
      logger.error({ error, memberId: member?.id }, 'Failed to send member join log');
    }
  }

  /**
   * Logs member leave
   */
  async sendMemberLeaveLog({ member, user, guild }) {
    const targetUser = user || member?.user;
    const targetGuild = guild || member?.guild;
    if (!targetUser || !targetGuild) return;

    try {
      const channel = await this.getMemberLogChannel(targetGuild);
      if (!channel) return;

      const embed = createHyoriEmbed()
        .setTitle("📤 Départ d'un Membre")
        .setColor(0xeb5757)
        .setThumbnail(
          targetUser.displayAvatarURL
            ? targetUser.displayAvatarURL({ dynamic: true, size: 256 })
            : null
        )
        .addFields(
          {
            name: '👤 Membre',
            value: `${targetUser.tag || targetUser.username} (\`${targetUser.id}\`)`,
            inline: true,
          },
          {
            name: '👥 Membres restants',
            value: `**${targetGuild.memberCount}** membres`,
            inline: true,
          }
        );

      if (member?.joinedTimestamp) {
        const joinedAt = Math.round(member.joinedTimestamp / 1000);
        embed.addFields({
          name: '📥 Avait rejoint le',
          value: `<t:${joinedAt}:F> (<t:${joinedAt}:R>)`,
          inline: false,
        });
      }

      if (member?.roles?.cache) {
        const rolesList = member.roles.cache
          .filter(r => r.id !== targetGuild.id)
          .map(r => `<@&${r.id}>`)
          .join(', ');

        if (rolesList.length > 0) {
          embed.addFields({
            name: `🎭 Rôles qu'il possédait (${member.roles.cache.size - 1})`,
            value: rolesList.slice(0, 1024),
            inline: false,
          });
        }
      }

      await channel.send({ embeds: [embed] });
      logger.info({ memberId: targetUser.id }, 'Member leave log sent');
    } catch (error) {
      logger.error({ error, memberId: targetUser.id }, 'Failed to send member leave log');
    }
  }
}

export const memberLogService = new MemberLogService();
