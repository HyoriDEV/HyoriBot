import { discordConfig } from '../../config/discordConfig.js';
import { GuildRegistry } from '../services/guildRegistry.js';
import { logger } from '../../logger/index.js';

/**
 * Gestionnaire d'événement GuildMemberUpdate.
 * Applique la règle de non-cumul stricte entre le rôle "Whitelist" et le rôle "Non-inscrit" (noWhitelist)
 * sur le serveur communautaire Hyori RP :
 * - Un membre ne doit JAMAIS avoir les deux rôles à la fois (si cumul, la Whitelist prime et noWhitelist est retiré).
 * - En revanche, si un modérateur/administrateur retire manuellement l'un des rôles (ou les deux),
 *   le bot N'INTERVIENT PAS pour réassigner quoi que ce soit, garantissant le plein contrôle humain.
 */
export async function handleGuildMemberUpdate(oldMember, newMember) {
  if (newMember.user.bot) return;
  if (!GuildRegistry.isCommunityGuild(newMember.guild.id)) return;

  const whitelistRoleId = discordConfig.roles.whitelist;
  const noWhitelistRoleId = discordConfig.roles.noWhitelist;

  if (!whitelistRoleId || !noWhitelistRoleId) return;

  const hasWhitelist = newMember.roles.cache.has(whitelistRoleId);
  const hasNoWhitelist = newMember.roles.cache.has(noWhitelistRoleId);

  // Règle de non-cumul : si le membre possède les DEUX rôles à la fois, on lui retire le rôle Non-inscrit
  if (hasWhitelist && hasNoWhitelist) {
    try {
      await newMember.roles.remove(
        noWhitelistRoleId,
        'Règle de non-cumul : membre whitelisté, retrait automatique du rôle Non-inscrit'
      );
      logger.info(
        { userId: newMember.id, userTag: newMember.user.tag },
        'Retrait automatique du rôle Non-inscrit (le membre possède la Whitelist)'
      );
    } catch (err) {
      logger.warn(
        { userId: newMember.id, error: err.message },
        'Impossible de retirer le rôle Non-inscrit (vérifier la hiérarchie des rôles)'
      );
    }
  }
}
