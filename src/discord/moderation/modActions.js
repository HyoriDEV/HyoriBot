import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { parseDuration } from './durationParser.js';
import { modLogService } from '../services/modLogService.js';
import { warnRepository } from '../../persistence/warnRepository.js';
import { roleBackupRepository } from '../../persistence/roleBackupRepository.js';
import { createHyoriEmbed } from '../embeds.js';
import { logger } from '../../logger/index.js';
import { getEnv } from '../../config/env.js';
export class ModActions {
  async executeMute({ guild, targetMember, moderator, durationStr, reason = 'Non précisé' }) {
    if (!targetMember) {
      return {
        success: false,
        error: 'Membre introuvable sur le serveur.',
      };
    }
    if (!targetMember.manageable && targetMember.id !== guild.ownerId) {
      return {
        success: false,
        error:
          'Impossible de modérer ce membre : ses rôles sont supérieurs ou égaux à ceux du bot.',
      };
    }
    const parsed = parseDuration(durationStr);
    if (!parsed || parsed.ms <= 0) {
      return {
        success: false,
        error: 'Durée invalide. Exemples valides : `60s`, `10m`, `1h`, `2d`, `1w`.',
      };
    }
    try {
      const dmEmbed = createHyoriEmbed()
        .setTitle('🔇 Sanction — Mise en sourdine (Mute)')
        .setDescription(
          `Tu as été rendu muet sur le serveur **${guild.name}** pour une durée de **${parsed.formatted}**.\n\n> **Motif :** ${reason}`
        );
      await targetMember
        .send({
          embeds: [dmEmbed],
        })
        .catch(() => {
          logger.warn(
            {
              targetId: targetMember.id,
            },
            'Could not send DM to muted member (DMs closed)'
          );
        });
      await targetMember.timeout(
        parsed.ms,
        `Mute par ${moderator.tag || moderator.username}: ${reason}`
      );
      await modLogService.sendModLog({
        guild,
        action: 'MUTE (TIMEOUT)',
        target: targetMember.user,
        moderator,
        duration: parsed.formatted,
        reason,
      });
      return {
        success: true,
        message: `🔇 **${targetMember.user.tag}** a été rendu muet pour **${parsed.formatted}**.\n> **Motif :** ${reason}`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetMember.id,
        },
        'Error executing mute'
      );
      return {
        success: false,
        error: `Échec du mute : ${error.message}`,
      };
    }
  }
  async executeUnmute({ guild, targetMember, moderator, reason = 'Levée de mute manuelle' }) {
    if (!targetMember) {
      return {
        success: false,
        error: 'Membre introuvable sur le serveur.',
      };
    }
    if (!targetMember.isCommunicationDisabled()) {
      return {
        success: false,
        error: "Ce membre n'est pas actuellement muet.",
      };
    }
    try {
      await targetMember.timeout(
        null,
        `Unmute par ${moderator.tag || moderator.username}: ${reason}`
      );
      const dmEmbed = createHyoriEmbed()
        .setTitle('🔊 Sanction levée — Fin du Mute')
        .setDescription(`Ta mise en sourdine sur le serveur **${guild.name}** a été levée.`);
      await targetMember
        .send({
          embeds: [dmEmbed],
        })
        .catch(() => null);
      await modLogService.sendModLog({
        guild,
        action: 'UNMUTE',
        target: targetMember.user,
        moderator,
        reason,
      });
      return {
        success: true,
        message: `🔊 Le mute de **${targetMember.user.tag}** a été levé avec succès.`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetMember.id,
        },
        'Error executing unmute'
      );
      return {
        success: false,
        error: `Échec de l'unmute : ${error.message}`,
      };
    }
  }
  async executeKick({ guild, targetMember, moderator, reason = 'Non précisé' }) {
    if (!targetMember) {
      return {
        success: false,
        error: 'Membre introuvable sur le serveur.',
      };
    }
    if (!targetMember.kickable) {
      return {
        success: false,
        error:
          "Impossible d'expulser ce membre (permissions insuffisantes ou hiérarchie supérieure).",
      };
    }
    try {
      const dmEmbed = createHyoriEmbed()
        .setTitle('👢 Sanction — Expulsion (Kick)')
        .setDescription(
          `Tu as été expulsé du serveur **${guild.name}**.\n\n> **Motif :** ${reason}`
        );
      await targetMember
        .send({
          embeds: [dmEmbed],
        })
        .catch(() => null);
      await targetMember.kick(`Expulsion par ${moderator.tag || moderator.username}: ${reason}`);
      await modLogService.sendModLog({
        guild,
        action: 'EXPULSION (KICK)',
        target: targetMember.user,
        moderator,
        reason,
      });
      return {
        success: true,
        message: `👢 **${targetMember.user.tag}** a été expulsé du serveur.\n> **Motif :** ${reason}`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetMember.id,
        },
        'Error executing kick'
      );
      return {
        success: false,
        error: `Échec de l'expulsion : ${error.message}`,
      };
    }
  }
  async executeBan({ guild, targetUser, moderator, reason = 'Non précisé', purgeDays = 0 }) {
    if (!targetUser) {
      return {
        success: false,
        error: 'Utilisateur introuvable.',
      };
    }
    const member = await guild.members.fetch(targetUser.id).catch(() => null);
    if (member && !member.bannable) {
      return {
        success: false,
        error:
          'Impossible de bannir ce membre (permissions insuffisantes ou hiérarchie supérieure).',
      };
    }
    try {
      const dmEmbed = createHyoriEmbed()
        .setTitle('🔨 Sanction — Bannissement')
        .setDescription(
          `Tu as été banni du serveur **${guild.name}**.\n\n> **Motif :** ${reason}\n\nTu peux formuler un recours via ticket sur Hyori Atlas.`
        );
      await targetUser
        .send({
          embeds: [dmEmbed],
        })
        .catch(() => null);
      const deleteMessageSeconds = Math.min(Math.max(purgeDays, 0), 7) * 24 * 60 * 60;
      await guild.bans.create(targetUser.id, {
        deleteMessageSeconds,
        reason: `Bannissement par ${moderator.tag || moderator.username}: ${reason}`,
      });
      await modLogService.sendModLog({
        guild,
        action: 'BANNISSEMENT (BAN)',
        target: targetUser,
        moderator,
        reason,
        extraFields: [
          {
            name: 'Messages purgés',
            value: `${purgeDays} jour(s)`,
            inline: true,
          },
        ],
      });
      return {
        success: true,
        message: `🔨 **${targetUser.tag || targetUser.username}** a été banni du serveur.\n> **Motif :** ${reason}`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetUser.id,
        },
        'Error executing ban'
      );
      return {
        success: false,
        error: `Échec du bannissement : ${error.message}`,
      };
    }
  }
  async executeUnban({ guild, userId, moderator, reason = 'Levée manuelle de bannissement' }) {
    if (!userId || !/^\d{17,20}$/.test(userId.trim())) {
      return {
        success: false,
        error: 'ID Discord invalide.',
      };
    }
    try {
      const banInfo = await guild.bans.fetch(userId.trim()).catch(() => null);
      if (!banInfo) {
        return {
          success: false,
          error: "Cet utilisateur n'est pas dans la liste des bannissements.",
        };
      }
      await guild.bans.remove(
        userId.trim(),
        `Débannissement par ${moderator.tag || moderator.username}: ${reason}`
      );
      await modLogService.sendModLog({
        guild,
        action: 'DÉBANNISSEMENT (UNBAN)',
        target: banInfo.user,
        moderator,
        reason,
      });
      return {
        success: true,
        message: `🔓 **${banInfo.user.tag}** (\`${banInfo.user.id}\`) a été débanni du serveur.`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          userId,
        },
        'Error executing unban'
      );
      return {
        success: false,
        error: `Échec du débannissement : ${error.message}`,
      };
    }
  }
  async executeClear({ channel, moderator, amount = 10, filterUser = null }) {
    if (!channel || !channel.isTextBased()) {
      return {
        success: false,
        error: 'Salon textuel invalide pour la suppression de messages.',
      };
    }
    const totalToClear = Math.min(Math.max(parseInt(amount, 10) || 10, 1), 100);
    try {
      let fetched = await channel.messages.fetch({ limit: 100 });
      if (filterUser) {
        fetched = fetched.filter(m => m.author.id === filterUser.id);
      }

      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const valid = fetched.filter(m => m.createdTimestamp > twoWeeksAgo);

      const toDelete = valid.first(totalToClear);
      if (!toDelete || toDelete.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          message: '🧹 Aucun message récent (de moins de 14 jours) à supprimer.',
        };
      }

      let deletedCount = 0;
      if (toDelete.length === 1) {
        await toDelete[0].delete();
        deletedCount = 1;
      } else {
        const deleted = await channel.bulkDelete(toDelete, true);
        deletedCount = deleted.size;
      }

      await modLogService.sendModLog({
        guild: channel.guild,
        action: 'NETTOYAGE (CLEAR / PURGE)',
        target: filterUser || { tag: 'Tous les messages récents', id: 'N/A' },
        moderator,
        reason: `${deletedCount} message(s) supprimé(s)`,
        extraFields: [
          { name: 'Salon', value: `<#${channel.id}> (\`#${channel.name}\`)`, inline: true },
          { name: 'Messages supprimés', value: `\`${deletedCount}\``, inline: true },
        ],
      });

      return {
        success: true,
        deletedCount,
        message: `🧹 **${deletedCount}** message(s) supprimé(s) avec succès${filterUser ? ` de **${filterUser.tag || filterUser.username}**` : ''}.`,
      };
    } catch (err) {
      logger.error({ err, channelId: channel.id }, 'Erreur lors du clear/purge de messages');
      return {
        success: false,
        error: `Impossible de supprimer les messages : ${err.message}`,
      };
    }
  }
  async executeLock({ channel, moderator, reason = 'Salon verrouillé par la modération' }) {
    if (!channel || !channel.isTextBased()) {
      return {
        success: false,
        error: 'Salon invalide.',
      };
    }
    try {
      await channel.permissionOverwrites.edit(channel.guild.id, {
        SendMessages: false,
        AddReactions: false,
      });
      const embed = createHyoriEmbed()
        .setTitle('🔒 Salon Verrouillé')
        .setDescription(`Ce salon a été verrouillé par la modération.\n> **Raison :** ${reason}`);
      await channel.send({
        embeds: [embed],
      });
      await modLogService.sendModLog({
        guild: channel.guild,
        action: 'VERROUILLAGE (LOCK)',
        target: {
          tag: `#${channel.name}`,
          id: channel.id,
        },
        moderator,
        reason,
      });
      return {
        success: true,
        message: `🔒 Le salon <#${channel.id}> est désormais verrouillé.`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          channelId: channel.id,
        },
        'Error executing lock'
      );
      return {
        success: false,
        error: `Échec du verrouillage : ${error.message}`,
      };
    }
  }
  async executeUnlock({ channel, moderator }) {
    if (!channel || !channel.isTextBased()) {
      return {
        success: false,
        error: 'Salon invalide.',
      };
    }
    try {
      await channel.permissionOverwrites.edit(channel.guild.id, {
        SendMessages: null,
        AddReactions: null,
      });
      const embed = createHyoriEmbed()
        .setTitle('🔓 Salon Déverrouillé')
        .setDescription('Le salon est de nouveau ouvert à la discussion.');
      await channel.send({
        embeds: [embed],
      });
      await modLogService.sendModLog({
        guild: channel.guild,
        action: 'DÉVERROUILLAGE (UNLOCK)',
        target: {
          tag: `#${channel.name}`,
          id: channel.id,
        },
        moderator,
        reason: 'Ouverture du salon',
      });
      return {
        success: true,
        message: `🔓 Le salon <#${channel.id}> est de nouveau déverrouillé.`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          channelId: channel.id,
        },
        'Error executing unlock'
      );
      return {
        success: false,
        error: `Échec du déverrouillage : ${error.message}`,
      };
    }
  }
  async executeClear({ channel, moderator, amount = 10, filterUser = null, commandName = 'clear' }) {
    if (!channel || !channel.isTextBased()) {
      return {
        success: false,
        error: 'Salon textuel invalide.',
      };
    }
    try {
      recentPurges.set(channel.id, {
        moderator,
        commandName,
        filterUser,
        timestamp: Date.now(),
      });

      const fetched = await channel.messages.fetch({ limit: Math.min(Math.max(amount, 1), 100) });
      const toDelete = filterUser
        ? fetched.filter(m => m.author.id === filterUser.id)
        : fetched;

      if (toDelete.size === 0) {
        return {
          success: true,
          message: 'ℹ️ Aucun message récent correspondant à supprimer.',
        };
      }

      const deleted = await channel.bulkDelete(toDelete, true);

      await modLogService.sendModLog({
        guild: channel.guild,
        action: `PURGE (${commandName.toUpperCase()})`,
        target: {
          tag: `#${channel.name}`,
          id: channel.id,
        },
        moderator,
        reason: filterUser
          ? `Suppression ciblée de ${deleted.size} message(s) de ${filterUser.tag}`
          : `Suppression de ${deleted.size} message(s)`,
        extraFields: [
          { name: 'Nombre supprimé', value: `${deleted.size}`, inline: true },
          { name: 'Cible', value: filterUser ? `<@${filterUser.id}>` : 'Tous les messages', inline: true },
        ],
      });

      return {
        success: true,
        message: `🧹 **${deleted.size}** message(s) supprimé(s) avec succès par <@${moderator.id}>.`,
      };
    } catch (error) {
      logger.error({ error, channelId: channel.id }, 'Error executing clear');
      return {
        success: false,
        error: `Échec de la suppression : ${error.message}`,
      };
    }
  }
  async executeSlowmode({ channel, moderator, seconds = 0 }) {
    if (!channel || !channel.setRateLimitPerUser) {
      return {
        success: false,
        error: 'Ce salon ne supporte pas le mode lent.',
      };
    }
    const sec = Math.min(Math.max(parseInt(seconds, 10) || 0, 0), 21600);
    try {
      await channel.setRateLimitPerUser(sec, `Slowmode par ${moderator.tag || moderator.username}`);
      await modLogService.sendModLog({
        guild: channel.guild,
        action: 'MODE LENT (SLOWMODE)',
        target: {
          tag: `#${channel.name}`,
          id: channel.id,
        },
        moderator,
        reason: sec === 0 ? 'Mode lent désactivé' : `Délai réglé sur ${sec}s`,
      });
      if (sec === 0) {
        return {
          success: true,
          message: `⏱️ Mode lent désactivé sur <#${channel.id}>.`,
        };
      }
      return {
        success: true,
        message: `⏱️ Mode lent activé sur <#${channel.id}> (**${sec} seconde(s)** entre les messages).`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          channelId: channel.id,
        },
        'Error executing slowmode'
      );
      return {
        success: false,
        error: `Échec de configuration du slowmode : ${error.message}`,
      };
    }
  }
  async executeWarn({ guild, targetUser, moderator, reason = 'Non précisé' }) {
    if (!targetUser) {
      return {
        success: false,
        error: 'Utilisateur introuvable.',
      };
    }
    try {
      const { warn, totalWarns } = await warnRepository.addWarn({
        discordId: targetUser.id,
        guildId: guild.id,
        moderatorId: moderator.id,
        moderatorTag: moderator.tag || moderator.username,
        reason,
      });
      const dmEmbed = createHyoriEmbed()
        .setTitle('⚠️ Avertissement Reçu')
        .setDescription(
          `Tu as reçu un avertissement sur le serveur **${guild.name}**.\n\n> **Motif :** ${reason}\n\n*Total d'avertissements : ${totalWarns}*`
        );
      await targetUser
        .send({
          embeds: [dmEmbed],
        })
        .catch(() => null);
      await modLogService.sendModLog({
        guild,
        action: 'AVERTISSEMENT (WARN)',
        target: targetUser,
        moderator,
        reason,
        extraFields: [
          {
            name: 'Avertissements au total',
            value: `${totalWarns}`,
            inline: true,
          },
        ],
      });
      return {
        success: true,
        message: `⚠️ **${targetUser.tag || targetUser.username}** a reçu un avertissement.\n> **Motif :** ${reason}\n> **Total des warns :** ${totalWarns} (ID: \`${warn.id}\`)`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetUser.id,
        },
        'Error executing warn'
      );
      return {
        success: false,
        error: `Échec de l'avertissement : ${error.message}`,
      };
    }
  }
  async executeWarnlist({ targetUser }) {
    if (!targetUser) {
      return {
        success: false,
        error: 'Utilisateur introuvable.',
      };
    }
    try {
      const warns = await warnRepository.getWarns(targetUser.id);
      if (warns.length === 0) {
        return {
          success: true,
          embed: createHyoriEmbed()
            .setTitle(`Avertissements — ${targetUser.tag || targetUser.username}`)
            .setDescription("✅ Cet utilisateur n'a aucun avertissement enregistré."),
        };
      }
      const embed = createHyoriEmbed()
        .setTitle(
          `📋 Historique des Avertissements — ${targetUser.tag || targetUser.username} (${warns.length})`
        )
        .setDescription(
          warns
            .map(
              (w, idx) =>
                `**#${idx + 1}** — \`${w.id}\` (<t:${Math.round(new Date(w.createdAt).getTime() / 1000)}:d>)\n` +
                `> **Modérateur :** ${w.moderatorTag}\n` +
                `> **Motif :** ${w.reason}`
            )
            .join('\n\n')
        );
      return {
        success: true,
        embed,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetUser.id,
        },
        'Error executing warnlist'
      );
      return {
        success: false,
        error: `Impossible de récupérer les warns : ${error.message}`,
      };
    }
  }
  async executeClearwarns({ targetUser, moderator, guild }) {
    if (!targetUser) {
      return {
        success: false,
        error: 'Utilisateur introuvable.',
      };
    }
    try {
      const count = await warnRepository.clearWarns(targetUser.id);
      await modLogService.sendModLog({
        guild,
        action: 'RÉINITIALISATION WARNS',
        target: targetUser,
        moderator,
        reason: `Effacement de ${count} avertissement(s)`,
      });
      return {
        success: true,
        message: `🗑️ **${count}** avertissement(s) ont été effacés pour **${targetUser.tag || targetUser.username}**.`,
      };
    } catch (error) {
      logger.error(
        {
          error,
          targetId: targetUser.id,
        },
        'Error executing clearwarns'
      );
      return {
        success: false,
        error: `Échec de réinitialisation des warns : ${error.message}`,
      };
    }
  }
  async executeUserinfo({ guild, targetMember, targetUser }) {
    const user = targetUser || targetMember?.user;
    if (!user)
      return {
        success: false,
        error: 'Utilisateur introuvable.',
      };
    const member = targetMember || (await guild.members.fetch(user.id).catch(() => null));
    const warns = await warnRepository.getWarns(user.id);
    const activeBackup = await roleBackupRepository.getActiveBackup(user.id);
    const env = getEnv();
    const isWhitelisted = member ? member.roles.cache.has(env.ROLE_WHITELIST_ID) : false;
    const isSanctioned = member ? member.roles.cache.has(env.ROLE_SANCTIONED_ID) : false;
    const embed = createHyoriEmbed()
      .setTitle(`Fiche Utilisateur — ${user.tag || user.username}`)
      .setThumbnail(
        user.displayAvatarURL({
          dynamic: true,
          size: 256,
        })
      )
      .addFields(
        {
          name: '🆔 Identifiant Discord',
          value: `\`${user.id}\``,
          inline: true,
        },
        {
          name: '📅 Compte créé le',
          value: `<t:${Math.round(user.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
        {
          name: '📥 Arrivé sur le serveur',
          value: member?.joinedTimestamp
            ? `<t:${Math.round(member.joinedTimestamp / 1000)}:F>`
            : 'Non présent',
          inline: true,
        },
        {
          name: '📜 Statut Whitelist',
          value: isWhitelisted ? '✅ Whitelisté' : '❌ Non whitelisté',
          inline: true,
        },
        {
          name: '⚖️ Statut Disciplinaire',
          value: isSanctioned ? '🚨 Sanctionné (Isolé)' : '🟢 Normal',
          inline: true,
        },
        {
          name: '⚠️ Avertissements (Warns)',
          value: `**${warns.length}** enregistrement(s)`,
          inline: true,
        }
      );
    if (member) {
      const rolesList = member.roles.cache
        .filter(r => r.id !== guild.id)
        .map(r => `<@&${r.id}>`)
        .join(', ');
      embed.addFields({
        name: `🎭 Rôles (${member.roles.cache.size - 1})`,
        value: rolesList.length > 0 ? rolesList : 'Aucun rôle',
        inline: false,
      });
    }
    if (activeBackup) {
      embed.addFields({
        name: '🔒 Sauvegarde de rôles active',
        value: `Type: \`${activeBackup.sanctionType}\` | Fin: ${activeBackup.expiresAt ? `<t:${Math.round(new Date(activeBackup.expiresAt).getTime() / 1000)}:R>` : 'Définitive'}`,
        inline: false,
      });
    }
    return {
      success: true,
      embed,
    };
  }
  async executeServerinfo({ guild }) {
    const owner = await guild.fetchOwner().catch(() => null);
    const embed = createHyoriEmbed()
      .setTitle(`Informations du Serveur — ${guild.name}`)
      .setThumbnail(
        guild.iconURL({
          dynamic: true,
          size: 256,
        })
      )
      .addFields(
        {
          name: '👑 Propriétaire',
          value: owner ? `${owner.user.tag} (\`${owner.id}\`)` : 'Inconnu',
          inline: true,
        },
        {
          name: '🆔 ID Serveur',
          value: `\`${guild.id}\``,
          inline: true,
        },
        {
          name: '📅 Date de création',
          value: `<t:${Math.round(guild.createdTimestamp / 1000)}:F>`,
          inline: true,
        },
        {
          name: '👥 Membres',
          value: `**${guild.memberCount}** membre(s)`,
          inline: true,
        },
        {
          name: '💬 Salons',
          value: `**${guild.channels.cache.size}** salon(s)`,
          inline: true,
        },
        {
          name: '🎭 Rôles',
          value: `**${guild.roles.cache.size}** rôle(s)`,
          inline: true,
        }
      );
    return {
      success: true,
      embed,
    };
  }
  executeHelp({ prefix = '!' }) {
    const embed = createHyoriEmbed()
      .setTitle('🛡️ Guide des Commandes de Modération HyoriBot')
      .setDescription(
        `HyoriBot supporte à la fois les commandes **Slash (\`/\`)** et les commandes textuelles avec le préfixe **\`${prefix}\`**.\n\n` +
          `### ⚖️ Sanctions & Membres\n` +
          `• \`${prefix}mute <@user> <durée> [motif]\` ou \`/mute\` : Rend un membre muet (ex: \`${prefix}mute @user 1h Spam\`).\n` +
          `• \`${prefix}unmute <@user> [motif]\` ou \`/unmute\` : Rétablit la parole d'un membre.\n` +
          `• \`${prefix}kick <@user> [motif]\` ou \`/kick\` : Expulse un membre avec notification DM.\n` +
          `• \`${prefix}ban <@user|ID> <motif> [jours]\` ou \`/ban\` : Bannit un joueur (purge 0-7j).\n` +
          `• \`${prefix}unban <ID> [motif]\` ou \`/unban\` : Débannit un utilisateur via son ID Discord.\n` +
          `• \`${prefix}warn <@user> <motif>\` ou \`/warn\` : Donne un avertissement enregistré.\n` +
          `• \`${prefix}warns <@user>\` ou \`/warnlist\` : Consulte l'historique des avertissements.\n` +
          `• \`${prefix}clearwarns <@user>\` ou \`/clearwarns\` : Efface les avertissements d'un joueur.\n\n` +
          `### 🧹 Gestion des Salons & Messages\n` +
          `• \`${prefix}clear <1-50> [@user]\` ou \`/clear\` : Supprime jusqu'à 50 messages récents.\n` +
          `• \`${prefix}lock [salon] [motif]\` ou \`/lock\` : Verrouille l'envoi de messages.\n` +
          `• \`${prefix}unlock [salon]\` ou \`/unlock\` : Déverrouille le salon.\n` +
          `• \`${prefix}slowmode <secondes|off>\` ou \`/slowmode\` : Active/désactive le mode lent.\n\n` +
          `### ℹ️ Informations\n` +
          `• \`${prefix}userinfo [@user]\` ou \`/userinfo\` : Affiche la fiche détaillée d'un membre.\n` +
          `• \`${prefix}serverinfo\` ou \`/serverinfo\` : Affiche les statistiques du serveur Discord.`
      );
    return {
      success: true,
      embed,
    };
  }
}
export const recentPurges = new Map();
export const modActions = new ModActions();
