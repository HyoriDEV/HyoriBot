import { ChannelType, PermissionFlagsBits, EmbedBuilder, AuditLogEvent } from 'discord.js';
import { getEnv } from '../../config/env.js';
import { configStore } from '../../storage/index.js';
import { createHyoriEmbed } from '../embeds.js';
import { logger } from '../../logger/index.js';
import { recentPurges } from '../moderation/modActions.js';

export class MemberLogService {
  /**
   * Finds or creates the member activity log channel based on target category
   */
  async getMemberLogChannel(guild, targetKey = 'members') {
    const config = await configStore.read().catch(() => ({}));
    const logs = config.logs || {};

    const keyMapping = {
      messages_delete: [logs.messagesDeleteChannelId, logs.messagesChannelId],
      messages_edit: [logs.messagesEditChannelId, logs.messagesChannelId],
      joins_leaves: [logs.joinsLeavesChannelId, logs.membersChannelId],
      voice: [logs.voiceChannelId],
      members: [logs.joinsLeavesChannelId, logs.membersChannelId]
    };

    const candidates = keyMapping[targetKey] || [logs[targetKey]];
    for (const id of candidates) {
      if (id) {
        const ch = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
        if (ch && ch.isTextBased()) return ch;
      }
    }

    const env = getEnv();

    // 1. Try by configured ID in env
    if (env.CHANNEL_MEMBER_LOGS_ID) {
      const channel = guild.channels.cache.get(env.CHANNEL_MEMBER_LOGS_ID);
      if (channel && channel.isTextBased()) return channel;
    }

    // 2. Try by common channel names
    const channelByName = guild.channels.cache.find(
      c =>
        (c.name === 'logs-membres' ||
          c.name.includes('logs-messages') ||
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
   * Logs deleted message with author, deletor (command or audit log) and Hyori Brand Guidelines DA
   */
  async sendDeletedMessageLog({ message }) {
    if (!message || !message.guild) return;

    try {
      const channel = await this.getMemberLogChannel(message.guild, 'messages_delete');
      if (!channel) return;

      const author = message.author;
      const authorText = author
        ? `<@${author.id}> (**${author.tag || author.username}** — \`${author.id}\`)`
        : '*Auteur inconnu*';

      // 1. Détection de l'exécuteur de la suppression
      let deletedByText = null;

      // Cas A : Suppression via commande /clear ou /purge
      const purge = recentPurges.get(message.channel.id);
      if (purge && Date.now() - purge.timestamp < 15000) {
        deletedByText = `🛠️ Modérateur <@${purge.moderator.id}> (**${purge.moderator.tag || purge.moderator.username}**) via la commande \`${purge.commandName || '/clear'}\``;
      }

      // Cas B : Recherche dans l'Audit Log Discord (suppression manuelle par un modérateur)
      if (!deletedByText && message.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        try {
          const auditLogs = await message.guild.fetchAuditLogs({
            type: AuditLogEvent.MessageDelete,
            limit: 1,
          }).catch(() => null);

          const entry = auditLogs?.entries.first();
          if (entry && entry.target?.id === author?.id && (Date.now() - entry.createdTimestamp < 15000)) {
            deletedByText = `🛡️ Modérateur <@${entry.executor.id}> (**${entry.executor.tag || entry.executor.username}**)`;
          }
        } catch {
          // Ignore audit log fetch failure
        }
      }

      // Cas C : Aucune trace dans l'Audit Log => L'auteur a supprimé son propre message
      if (!deletedByText) {
        deletedByText = author
          ? `👤 L'auteur lui-même (<@${author.id}>)`
          : '*Inconnu / Non détecté*';
      }

      const content = message.content && message.content.trim().length > 0
        ? `>>> ${message.content.slice(0, 1000)}`
        : '*Aucun contenu textuel (message vide ou média seul)*';

      const createdTime = message.createdTimestamp
        ? `<t:${Math.floor(message.createdTimestamp / 1000)}:f> (<t:${Math.floor(message.createdTimestamp / 1000)}:R>)`
        : '*Date inconnue*';

      // DA Hyori Brand Guidelines (Or chaud #e9d15c)
      const embed = new EmbedBuilder()
        .setColor(0xe9d15c)
        .setTitle('🗑️ Message Supprimé')
        .setDescription('Un message a été supprimé des salons textuels du serveur.')
        .addFields(
          {
            name: '👤 Auteur du Message',
            value: authorText,
            inline: false,
          },
          {
            name: '🛠️ Supprimé par',
            value: deletedByText,
            inline: false,
          },
          {
            name: '💬 Salon',
            value: `<#${message.channel.id}> (\`#${message.channel.name}\`)`,
            inline: true,
          },
          {
            name: '📅 Date d\'Envoi Original',
            value: createdTime,
            inline: true,
          },
          {
            name: '📝 Contenu Supprimé',
            value: content,
            inline: false,
          }
        );

      if (message.attachments && message.attachments.size > 0) {
        const fileNames = message.attachments
          .map(a => `• [${a.name || 'Fichier'}](${a.url})`)
          .join('\n');
        embed.addFields({
          name: `📎 Pièce(s) Jointe(s) (${message.attachments.size})`,
          value: fileNames.slice(0, 1024),
          inline: false,
        });
      }

      embed.setFooter({ text: 'HYORI RP • Surveillance & Audit de Sécurité' });
      embed.setTimestamp();

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
   * Logs edited message with Hyori Brand Guidelines DA
   */
  async sendEditedMessageLog({ oldMessage, newMessage }) {
    if (!newMessage || !newMessage.guild) return;

    try {
      const channel = await this.getMemberLogChannel(newMessage.guild, 'messages_edit');
      if (!channel) return;

      const author = newMessage.author;
      const authorText = author
        ? `<@${author.id}> (**${author.tag || author.username}** — \`${author.id}\`)`
        : '*Auteur inconnu*';

      const oldContent = oldMessage.content && oldMessage.content.trim().length > 0
        ? `>>> ${oldMessage.content.slice(0, 1000)}`
        : '*Non disponible (non mis en cache)*';

      const newContent = newMessage.content && newMessage.content.trim().length > 0
        ? `>>> ${newMessage.content.slice(0, 1000)}`
        : '*Aucun contenu textuel*';

      // DA Hyori Brand Guidelines (Or chaud #e9d15c)
      const embed = new EmbedBuilder()
        .setColor(0xe9d15c)
        .setTitle('✏️ Message Modifié')
        .setDescription('Un message a été édité dans un salon textuel.')
        .addFields(
          {
            name: '👤 Auteur du Message',
            value: authorText,
            inline: true,
          },
          {
            name: '💬 Salon',
            value: `<#${newMessage.channel.id}> (\`#${newMessage.channel.name}\`)`,
            inline: true,
          },
          {
            name: '🔗 Accès Rapide',
            value: `[Accéder au message](${newMessage.url})`,
            inline: true,
          },
          {
            name: '⬅️ Contenu Avant Modification',
            value: oldContent,
            inline: false,
          },
          {
            name: '➡️ Contenu Après Modification',
            value: newContent,
            inline: false,
          }
        )
        .setFooter({ text: 'HYORI RP • Surveillance & Audit de Sécurité' })
        .setTimestamp();

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
      const channel = await this.getMemberLogChannel(guild, 'voice');
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
      const channel = await this.getMemberLogChannel(member.guild, 'joins_leaves');
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
      const channel = await this.getMemberLogChannel(targetGuild, 'joins_leaves');
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
