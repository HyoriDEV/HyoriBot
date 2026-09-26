import { GuildRegistry } from './guildRegistry.js';
import { discordConfig } from '../../config/discordConfig.js';
import { modLogService } from './modLogService.js';
import { logger } from '../../logger/index.js';

export const GENERIC_KICK_REASON = 'Tu ne fais pas partie de ce village.';

export class VillageGatekeeperService {
  /**
   * Vérifie l'éligibilité d'un joueur lors de son entrée sur un serveur Discord de village.
   *
   * Conditions requises :
   * 1. Être présent sur le serveur communautaire (Hyori RP).
   * 2. Posséder le rôle Whitelist sur le serveur communautaire.
   * 3. Posséder le rôle de classe correspondant au village sur le serveur communautaire.
   *
   * Si l'une des conditions manque : exclusion immédiate avec message au tutoiement.
   * Si les conditions sont remplies : attribution automatique du rôle "Habitant" par défaut
   * pour débloquer l'accès à tous les salons du village.
   *
   * @param {import('discord.js').GuildMember} member
   * @returns {Promise<{ allowed: boolean, isVillage: boolean, reason?: string }>}
   */
  static async checkMemberEntry(member) {
    if (!member || !member.guild) {
      return { allowed: true, isVillage: false };
    }

    const guildId = member.guild.id;
    if (!GuildRegistry.isVillageGuild(guildId)) {
      return { allowed: true, isVillage: false };
    }

    const village = GuildRegistry.getVillageConfig(guildId);
    if (!village) {
      return { allowed: true, isVillage: false };
    }

    const communityGuildId = GuildRegistry.getCommunityGuildId();

    try {
      const communityGuild =
        member.client.guilds.cache.get(communityGuildId) ||
        (await member.client.guilds.fetch(communityGuildId).catch(() => null));

      if (!communityGuild) {
        logger.error(
          { communityGuildId, villageGuildId: guildId },
          'Serveur communautaire Hyori RP introuvable lors de la vérification de village'
        );
        // Par sécurité : impossible de vérifier, rejet du membre
        await this.rejectMember(
          member,
          village,
          'Serveur communautaire inaccessible pour valider les rôles'
        );
        return { allowed: false, isVillage: true, reason: 'Serveur communautaire inaccessible' };
      }

      // Récupération du membre sur le serveur communautaire
      const communityMember = await communityGuild.members.fetch(member.id).catch(() => null);

      if (!communityMember) {
        logger.warn(
          { userId: member.id, userTag: member.user.tag, village: village.name },
          'Membre non trouvé sur le serveur communautaire Hyori RP'
        );
        await this.rejectMember(member, village, 'Absent du serveur communautaire Hyori RP');
        return { allowed: false, isVillage: true, reason: 'Absent du serveur communautaire' };
      }

      // Vérification 1 : Rôle Whitelist
      const whitelistRoleId = discordConfig.roles.whitelist;
      const hasWhitelistRole = Boolean(
        whitelistRoleId && communityMember.roles.cache.has(whitelistRoleId)
      );

      // Vérification 2 : Rôle de classe correspondant au village
      const classRoleId = discordConfig.roles.classes[village.class];
      const hasClassRole = Boolean(classRoleId && communityMember.roles.cache.has(classRoleId));

      if (!hasWhitelistRole || !hasClassRole) {
        let internalReason = '';
        if (!hasWhitelistRole && !hasClassRole) {
          internalReason = `Non whitelisté et classe incorrecte (requis : ${village.class})`;
        } else if (!hasWhitelistRole) {
          internalReason = 'Joueur non whitelisté';
        } else {
          internalReason = `Classe incorrecte pour ce village (requis : ${village.class})`;
        }

        logger.info(
          {
            userId: member.id,
            userTag: member.user.tag,
            village: village.name,
            hasWhitelistRole,
            hasClassRole,
            requiredClass: village.class,
          },
          'Accès au village refusé - Exclusion du joueur'
        );

        await this.rejectMember(member, village, internalReason);
        return { allowed: false, isVillage: true, reason: internalReason };
      }

      // =========================================================================
      // Joueur validé : attribution automatique du rôle par défaut "Habitant"
      // =========================================================================
      if (!village.habitantRoleId) {
        logger.warn(
          { village: village.name },
          'Aucun rôle Habitant configuré pour ce village (discordConfig.guilds.villages)'
        );
      } else {
        try {
          const habitantRole =
            member.guild.roles.cache.get(village.habitantRoleId) ||
            (await member.guild.roles.fetch(village.habitantRoleId).catch(() => null));

          if (habitantRole) {
            await member.roles.add(
              habitantRole,
              'Attribution automatique du rôle Habitant après validation de la classe'
            );
            logger.info(
              { memberId: member.id, village: village.name, roleId: village.habitantRoleId },
              'Rôle Habitant attribué avec succès sur le village'
            );
          } else {
            logger.warn(
              { village: village.name, roleId: village.habitantRoleId },
              'Rôle Habitant configuré introuvable sur le serveur de village'
            );
          }
        } catch (roleError) {
          logger.error(
            { error: roleError.message, memberId: member.id, village: village.name },
            'Impossible d\'attribuer le rôle Habitant au membre'
          );
        }
      }

      logger.info(
        {
          userId: member.id,
          userTag: member.user.tag,
          village: village.name,
          class: village.class,
        },
        'Vérification d\'entrée village validée et rôle Habitant synchronisé'
      );

      return { allowed: true, isVillage: true, village };
    } catch (error) {
      logger.error(
        { error: error.message, userId: member.id, villageGuildId: guildId },
        'Erreur inattendue lors de la vérification d\'entrée village'
      );
      return { allowed: false, isVillage: true, error: error.message };
    }
  }

  /**
   * Expulse un membre non éligible avec message d'avertissement au tutoiement et journalisation.
   */
  static async rejectMember(member, village, internalReason) {
    // 1. Message privé courtois au tutoiement
    try {
      await member
        .send({
          content: `Tu ne fais pas partie du serveur **${village.name}** (tu dois avoir le statut whitelisté et appartenir à ce village sur Hyori RP).`,
        })
        .catch(() => null);
    } catch {
      // Ignorer si les DMs sont fermés
    }

    // 2. Exclusion avec la raison générique attendue
    try {
      if (member.kickable) {
        await member.kick(GENERIC_KICK_REASON);
      } else {
        logger.warn(
          { memberId: member.id, guildId: member.guild.id },
          'Le bot ne dispose pas de la permission nécessaire pour exclure ce membre (kickable: false)'
        );
      }
    } catch (kickError) {
      logger.error(
        { error: kickError.message, memberId: member.id, guildId: member.guild.id },
        'Échec lors de l\'exclusion du membre'
      );
    }

    // 3. Journalisation dans les logs de modération du village
    try {
      await modLogService.sendModLog({
        guild: member.guild,
        action: 'CONTRÔLE ENTRÉE VILLAGE (EXPULSION)',
        target: member.user,
        moderator: {
          tag: 'HyoriBot (Gatekeeper)',
          id: member.client.user?.id || 'bot',
        },
        reason: `${GENERIC_KICK_REASON} [Détail staff : ${internalReason}]`,
      });
    } catch (logError) {
      logger.warn({ error: logError.message }, 'Impossible d\'envoyer le log d\'exclusion village');
    }
  }
}
