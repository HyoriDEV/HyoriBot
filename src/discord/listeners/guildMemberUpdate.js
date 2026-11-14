import { discordConfig } from '../../config/discordConfig.js';
import { GuildRegistry } from '../services/guildRegistry.js';
import { logger } from '../../logger/index.js';

/**
 * Gestionnaire d'événement GuildMemberUpdate.
 * Applique la règle d'exclusivité stricte entre le rôle "Whitelist" et le rôle "Non-inscrit"
 * sur le serveur communautaire Hyori RP :
 * - Si le joueur est whitelisté, il NE DOIT PAS avoir le rôle Non-inscrit.
 * - Si le joueur n'est pas whitelisté, il DOIT avoir le rôle Non-inscrit (sauf sanction/isolation).
 */
export async function handleGuildMemberUpdate(oldMember, newMember) {
  if (newMember.user.bot) return;
  if (!GuildRegistry.isCommunityGuild(newMember.guild.id)) return;

  const whitelistRoleId = discordConfig.roles.whitelist;
  const nonInscritRoleId = discordConfig.roles.nonInscrit;
  const sanctionedRoleId = discordConfig.roles.sanctioned;

  if (!whitelistRoleId || !nonInscritRoleId) return;

  // Si le joueur est sanctionné / isolé, on ne lui applique pas le rôle Non-inscrit
  if (sanctionedRoleId && newMember.roles.cache.has(sanctionedRoleId)) {
    return;
  }

  const hasWhitelist = newMember.roles.cache.has(whitelistRoleId);
  const hasNonInscrit = newMember.roles.cache.has(nonInscritRoleId);

  // Cas 1 : Le membre a les DEUX rôles -> Priorité absolue à la Whitelist, retrait immédiat de Non-inscrit
  if (hasWhitelist && hasNonInscrit) {
    try {
      await newMember.roles.remove(
        nonInscritRoleId,
        'Exclusivité stricte : joueur whitelisté, retrait automatique du rôle Non-inscrit'
      );
      logger.info(
        { userId: newMember.id, userTag: newMember.user.tag },
        'Retrait automatique du rôle Non-inscrit (le membre est whitelisté)'
      );
    } catch (err) {
      logger.warn(
        { userId: newMember.id, error: err.message },
        'Impossible de retirer le rôle Non-inscrit (vérifier la hiérarchie des rôles)'
      );
    }
    return;
  }

  // Cas 2 : Le membre n'a AUCUN des deux rôles -> Attribution automatique de Non-inscrit
  if (!hasWhitelist && !hasNonInscrit) {
    try {
      await newMember.roles.add(
        nonInscritRoleId,
        'Exclusivité stricte : joueur non whitelisté, attribution automatique du rôle Non-inscrit'
      );
      logger.info(
        { userId: newMember.id, userTag: newMember.user.tag },
        "Attribution automatique du rôle Non-inscrit (le membre n'est pas whitelisté)"
      );
    } catch (err) {
      logger.warn(
        { userId: newMember.id, error: err.message },
        "Impossible d'attribuer le rôle Non-inscrit (vérifier la hiérarchie des rôles)"
      );
    }
  }
}
