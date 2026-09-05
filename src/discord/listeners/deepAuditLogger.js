import {
  Events,
  AuditLogEvent,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField
} from 'discord.js';
import { configStore } from '../../storage/index.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../logger/index.js';
import { recentPurges } from '../moderation/modActions.js';

/**
 * Moteur de Deep Logging exhaustif pour Discord.js v14.
 * Écoute et journalise l'intégralité des événements du serveur avec recherche d'auteur dans l'Audit Log.
 */
export class DeepAuditLogger {
  /**
   * Résout le salon de destination selon la catégorie demandée avec fallback hiérarchique.
   */
  static async getLogChannel(guild, categoryKey) {
    try {
      const config = await configStore.read().catch(() => ({}));
      const logs = config.logs || {};

      // Table de correspondance clé cible -> clés de fallback
      const keyMapping = {
        messages_delete: [logs.messagesDeleteChannelId, logs.messagesChannelId],
        messages_edit: [logs.messagesEditChannelId, logs.messagesChannelId],
        messages_bulk: [logs.messagesBulkChannelId, logs.messagesDeleteChannelId, logs.messagesChannelId],
        joins_leaves: [logs.joinsLeavesChannelId, logs.membersChannelId],
        member_profile: [logs.memberProfileChannelId, logs.membersChannelId],
        member_roles: [logs.memberRolesChannelId, logs.membersChannelId],
        moderation: [logs.moderationChannelId],
        channels: [logs.channelsChannelId, logs.moderationChannelId],
        roles: [logs.rolesChannelId, logs.moderationChannelId],
        voice: [logs.voiceChannelId],
        server: [logs.serverChannelId, logs.moderationChannelId],
        invites: [logs.invitesChannelId, logs.moderationChannelId],
      };

      const candidates = keyMapping[categoryKey] || [logs[categoryKey]];

      for (const candidateId of candidates) {
        if (candidateId) {
          const channel = guild.channels.cache.get(candidateId) ||
                          await guild.channels.fetch(candidateId).catch(() => null);
          if (channel && channel.isTextBased()) return channel;
        }
      }

      // Fallback variables d'environnement
      const env = getEnv();
      const fallbackId = (categoryKey === 'joins_leaves' || categoryKey === 'member_profile' || categoryKey === 'member_roles')
        ? env.CHANNEL_MEMBER_LOGS_ID
        : env.CHANNEL_MOD_LOGS_ID;

      if (fallbackId) {
        const channel = guild.channels.cache.get(fallbackId) ||
                        await guild.channels.fetch(fallbackId).catch(() => null);
        if (channel && channel.isTextBased()) return channel;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Envoie un embed vers le salon de destination approprié.
   */
  static async send(guild, categoryKey, embed) {
    if (!guild) return;
    try {
      const channel = await this.getLogChannel(guild, categoryKey);
      if (channel) {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {
      logger.error({ error, categoryKey }, 'Erreur lors de l\'envoi du log d\'audit');
    }
  }

  /**
   * Récupère l'exécuteur d'une action depuis l'Audit Log de Discord.
   */
  static async fetchExecutor(guild, auditLogType, targetId = null) {
    try {
      if (!guild.members.me?.permissions.has(PermissionsBitField.Flags.ViewAuditLog)) {
        return null;
      }
      const logs = await guild.fetchAuditLogs({ type: auditLogType, limit: 1 }).catch(() => null);
      if (!logs) return null;
      const entry = logs.entries.first();
      if (!entry) return null;

      if (targetId && entry.target?.id && entry.target.id !== targetId) {
        return null;
      }

      if (Date.now() - entry.createdTimestamp > 15000) {
        return null;
      }

      return entry.executor;
    } catch {
      return null;
    }
  }

  /**
   * Enregistre tous les écouteurs de Deep Logging sur le client Discord.
   * @param {import('discord.js').Client} client
   */
  static register(client) {
    logger.info('Activation du moteur Deep Logging (Audit Exhaustif)...');

    // 1. Salons (Création, Suppression, Modification)
    client.on(Events.ChannelCreate, async channel => {
      if (!channel.guild) return;
      const executor = await this.fetchExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📁 Salon Créé')
        .addFields(
          { name: 'Nom', value: `${channel.name} (<#${channel.id}>)`, inline: true },
          { name: 'Type', value: `\`${ChannelType[channel.type] || channel.type}\``, inline: true },
          { name: 'Catégorie', value: channel.parent ? channel.parent.name : '*Aucune*', inline: true },
          { name: 'Créé par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu / Non détecté*', inline: false }
        )
        .setTimestamp();

      await this.send(channel.guild, 'channels', embed);
    });

    client.on(Events.ChannelDelete, async channel => {
      if (!channel.guild) return;
      const executor = await this.fetchExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Salon Supprimé')
        .addFields(
          { name: 'Nom', value: `\`#${channel.name}\` (\`${channel.id}\`)`, inline: true },
          { name: 'Type', value: `\`${ChannelType[channel.type] || channel.type}\``, inline: true },
          { name: 'Supprimé par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu / Non détecté*', inline: false }
        )
        .setTimestamp();

      await this.send(channel.guild, 'channels', embed);
    });

    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
      if (!newChannel.guild) return;
      const changes = [];

      if (oldChannel.name !== newChannel.name) {
        changes.push(`• **Nom :** \`#${oldChannel.name}\` ➔ \`#${newChannel.name}\``);
      }
      if (oldChannel.topic !== newChannel.topic) {
        changes.push(`• **Description/Topic :** \n*Avant :* ${oldChannel.topic || 'Aucun'}\n*Après :* ${newChannel.topic || 'Aucun'}`);
      }
      if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
        changes.push(`• **Mode lent (Slowmode) :** \`${oldChannel.rateLimitPerUser}s\` ➔ \`${newChannel.rateLimitPerUser}s\``);
      }
      if (oldChannel.nsfw !== newChannel.nsfw) {
        changes.push(`• **NSFW :** \`${oldChannel.nsfw ? 'Oui' : 'Non'}\` ➔ \`${newChannel.nsfw ? 'Oui' : 'Non'}\``);
      }

      if (changes.length === 0) return;

      const executor = await this.fetchExecutor(newChannel.guild, AuditLogEvent.ChannelUpdate, newChannel.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⚙️ Salon Modifié')
        .setDescription(`Salon : <#${newChannel.id}>\n\n${changes.join('\n')}`)
        .addFields({
          name: 'Modifié par',
          value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu / Non détecté*'
        })
        .setTimestamp();

      await this.send(newChannel.guild, 'channels', embed);
    });

    // 2. Rôles Serveur (Création, Suppression, Modification)
    client.on(Events.GuildRoleCreate, async role => {
      const executor = await this.fetchExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🏷️ Rôle Créé')
        .addFields(
          { name: 'Nom', value: `<@&${role.id}> (\`${role.name}\`)`, inline: true },
          { name: 'Couleur', value: `\`${role.hexColor}\``, inline: true },
          { name: 'Créé par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: false }
        )
        .setTimestamp();

      await this.send(role.guild, 'roles', embed);
    });

    client.on(Events.GuildRoleDelete, async role => {
      const executor = await this.fetchExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Rôle Supprimé')
        .addFields(
          { name: 'Nom', value: `\`@${role.name}\` (\`${role.id}\`)`, inline: true },
          { name: 'Supprimé par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: true }
        )
        .setTimestamp();

      await this.send(role.guild, 'roles', embed);
    });

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
      const changes = [];

      if (oldRole.name !== newRole.name) {
        changes.push(`• **Nom :** \`${oldRole.name}\` ➔ \`${newRole.name}\``);
      }
      if (oldRole.hexColor !== newRole.hexColor) {
        changes.push(`• **Couleur :** \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
      }
      if (oldRole.hoist !== newRole.hoist) {
        changes.push(`• **Affichage séparé (Hoist) :** \`${oldRole.hoist ? 'Oui' : 'Non'}\` ➔ \`${newRole.hoist ? 'Oui' : 'Non'}\``);
      }
      if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(`• **Mentionnable :** \`${oldRole.mentionable ? 'Oui' : 'Non'}\` ➔ \`${newRole.mentionable ? 'Oui' : 'Non'}\``);
      }

      if (changes.length === 0) return;

      const executor = await this.fetchExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏷️ Rôle Modifié')
        .setDescription(`Rôle : <@&${newRole.id}>\n\n${changes.join('\n')}`)
        .addFields({
          name: 'Modifié par',
          value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*'
        })
        .setTimestamp();

      await this.send(newRole.guild, 'roles', embed);
    });

    // 3. Bannissements & Débannissements
    client.on(Events.GuildBanAdd, async ban => {
      const executor = await this.fetchExecutor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔨 Membre Banni du Serveur')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
          { name: 'Membre', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
          { name: 'Banni par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: true },
          { name: 'Raison', value: ban.reason || '*Aucune raison spécifiée*', inline: false }
        )
        .setTimestamp();

      await this.send(ban.guild, 'moderation', embed);
    });

    client.on(Events.GuildBanRemove, async ban => {
      const executor = await this.fetchExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🤝 Membre Débanni du Serveur')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
          { name: 'Membre', value: `${ban.user.tag} (\`${ban.user.id}\`)`, inline: true },
          { name: 'Débanni par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: true }
        )
        .setTimestamp();

      await this.send(ban.guild, 'moderation', embed);
    });

    // 4. Purge Massive (Bulk Delete)
    client.on(Events.MessageBulkDelete, async (messages, channel) => {
      let executorText = null;

      // Vérifier le tracker des purges récentes (/clear ou /purge)
      const purge = recentPurges.get(channel.id);
      if (purge && Date.now() - purge.timestamp < 15000) {
        executorText = `🛠️ Modérateur <@${purge.moderator.id}> (**${purge.moderator.tag || purge.moderator.username}**) via la commande \`${purge.commandName || '/clear'}\``;
      }

      // Fallback audit log Discord
      if (!executorText) {
        const executor = await this.fetchExecutor(channel.guild, AuditLogEvent.MessageBulkDelete);
        if (executor) {
          executorText = `🛡️ Modérateur <@${executor.id}> (**${executor.tag || executor.username}**)`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xe9d15c) // Hyori Brand Guidelines (Or chaud)
        .setTitle('🧹 Purge Massive de Messages (Bulk Delete)')
        .setDescription('Une suppression groupée de messages a été opérée dans un salon.')
        .addFields(
          { name: '💬 Salon', value: `<#${channel.id}> (\`#${channel.name}\`)`, inline: true },
          { name: '🗑️ Messages Supprimés', value: `\`${messages.size}\``, inline: true },
          { name: '🛠️ Effectué par', value: executorText || '*Auteur inconnu / Exécution directe*', inline: false }
        )
        .setFooter({ text: 'HYORI RP • Surveillance & Audit de Sécurité' })
        .setTimestamp();

      await this.send(channel.guild, 'messages_bulk', embed);
    });

    // 5. Invitations (Création & Suppression)
    client.on(Events.InviteCreate, async invite => {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✉️ Invitation Créée')
        .addFields(
          { name: 'Code', value: `\`${invite.code}\``, inline: true },
          { name: 'Salon', value: invite.channel ? `<#${invite.channel.id}>` : '*Inconnu*', inline: true },
          { name: 'Créateur', value: invite.inviter ? `${invite.inviter.tag} (\`${invite.inviter.id}\`)` : '*Inconnu*', inline: true },
          { name: 'Utilisations max', value: invite.maxUses ? `\`${invite.maxUses}\`` : 'Illimité', inline: true },
          { name: 'Expiration', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : 'Jamais', inline: true }
        )
        .setTimestamp();

      await this.send(invite.guild, 'invites', embed);
    });

    client.on(Events.InviteDelete, async invite => {
      const embed = new EmbedBuilder()
        .setColor(0x99AAB5)
        .setTitle('✉️ Invitation Supprimée / Expirée')
        .addFields(
          { name: 'Code', value: `\`${invite.code}\``, inline: true },
          { name: 'Salon', value: invite.channel ? `<#${invite.channel.id}>` : '*Inconnu*', inline: true }
        )
        .setTimestamp();

      await this.send(invite.guild, 'invites', embed);
    });

    // 6. Émojis & Stickers
    client.on(Events.GuildEmojiCreate, async emoji => {
      const executor = await this.fetchExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('😀 Emoji Ajouté')
        .setThumbnail(emoji.imageURL())
        .addFields(
          { name: 'Nom', value: `:${emoji.name}: (\`${emoji.id}\`)`, inline: true },
          { name: 'Animé ?', value: emoji.animated ? 'Oui' : 'Non', inline: true },
          { name: 'Ajouté par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: false }
        )
        .setTimestamp();

      await this.send(emoji.guild, 'server', embed);
    });

    client.on(Events.GuildEmojiDelete, async emoji => {
      const executor = await this.fetchExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Emoji Supprimé')
        .addFields(
          { name: 'Nom', value: `:${emoji.name}: (\`${emoji.id}\`)`, inline: true },
          { name: 'Supprimé par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: true }
        )
        .setTimestamp();

      await this.send(emoji.guild, 'server', embed);
    });

    // 7. Paramètres Serveur
    client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
      const changes = [];

      if (oldGuild.name !== newGuild.name) {
        changes.push(`• **Nom du serveur :** \`${oldGuild.name}\` ➔ \`${newGuild.name}\``);
      }
      if (oldGuild.icon !== newGuild.icon) {
        changes.push(`• **Icône modifiée :** [Nouvelle icône](${newGuild.iconURL()})`);
      }
      if (oldGuild.banner !== newGuild.banner) {
        changes.push('• **Bannière du serveur mise à jour**');
      }

      if (changes.length === 0) return;

      const executor = await this.fetchExecutor(newGuild, AuditLogEvent.GuildUpdate);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🏰 Paramètres Serveur Modifiés')
        .setDescription(changes.join('\n'))
        .addFields({
          name: 'Modifié par',
          value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*'
        })
        .setTimestamp();

      await this.send(newGuild, 'server', embed);
    });

    // 8. Fils de Discussion (Threads)
    client.on(Events.ThreadCreate, async thread => {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🧵 Fil de Discussion Créé')
        .addFields(
          { name: 'Nom', value: `${thread.name} (<#${thread.id}>)`, inline: true },
          { name: 'Salon parent', value: thread.parent ? `<#${thread.parent.id}>` : '*Aucun*', inline: true }
        )
        .setTimestamp();

      await this.send(thread.guild, 'channels', embed);
    });

    client.on(Events.ThreadDelete, async thread => {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Fil de Discussion Supprimé')
        .addFields(
          { name: 'Nom', value: `\`${thread.name}\` (\`${thread.id}\`)`, inline: true },
          { name: 'Salon parent', value: thread.parent ? `<#${thread.parent.id}>` : '*Aucun*', inline: true }
        )
        .setTimestamp();

      await this.send(thread.guild, 'channels', embed);
    });

    // 9. Modifications Membres (Surnoms, Avatars, Rôles, Timeouts)
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      if (!newMember.guild) return;

      // Surnom
      if (oldMember.nickname !== newMember.nickname) {
        const oldNick = oldMember.nickname || oldMember.user.displayName;
        const newNick = newMember.nickname || newMember.user.displayName;
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('👤 Changement de Surnom')
          .setThumbnail(newMember.user.displayAvatarURL())
          .addFields(
            { name: 'Membre', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
            { name: 'Avant', value: `\`${oldNick}\``, inline: true },
            { name: 'Après', value: `\`${newNick}\``, inline: true }
          )
          .setTimestamp();
        await this.send(newMember.guild, 'member_profile', embed);
      }

      // Rôles ajoutés
      const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      if (addedRoles.size > 0) {
        const executor = await this.fetchExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🛡️ Rôle(s) Attribué(s)')
          .setThumbnail(newMember.user.displayAvatarURL())
          .addFields(
            { name: 'Membre', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
            { name: 'Rôle(s) Ajouté(s)', value: addedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true },
            { name: 'Attribué par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu / Auto*', inline: false }
          )
          .setTimestamp();
        await this.send(newMember.guild, 'member_roles', embed);
      }

      // Rôles retirés
      const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
      if (removedRoles.size > 0) {
        const executor = await this.fetchExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🛡️ Rôle(s) Retiré(s)')
          .setThumbnail(newMember.user.displayAvatarURL())
          .addFields(
            { name: 'Membre', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
            { name: 'Rôle(s) Retiré(s)', value: removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true },
            { name: 'Retiré par', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu / Auto*', inline: false }
          )
          .setTimestamp();
        await this.send(newMember.guild, 'member_roles', embed);
      }

      // Exclusion temporaire (Timeout natif)
      if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
        const isTimeout = newMember.isCommunicationDisabled();
        const executor = await this.fetchExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);

        const embed = new EmbedBuilder()
          .setColor(isTimeout ? 0xED4245 : 0x57F287)
          .setTitle(isTimeout ? '⏳ Membre Mis en Timeout' : '🔊 Timeout Levé')
          .setThumbnail(newMember.user.displayAvatarURL())
          .addFields(
            { name: 'Membre', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: true },
            { name: isTimeout ? 'Expire' : 'Statut', value: isTimeout ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>` : 'Parole rétablie', inline: true },
            { name: 'Modérateur', value: executor ? `${executor.tag} (\`${executor.id}\`)` : '*Inconnu*', inline: false }
          )
          .setTimestamp();

        await this.send(newMember.guild, 'moderation', embed);
        await this.send(newMember.guild, 'member_profile', embed);
      }
    });
  }
}
