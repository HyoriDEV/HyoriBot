import { AttachmentBuilder } from 'discord.js';
import { memberLogService } from '../services/memberLogService.js';
import { antiRaidService } from '../../services/antiRaidService.js';
import { WelcomeCardService } from '../../services/welcomeCardService.js';
import { configStore } from '../../storage/index.js';
import { GuildRegistry } from '../services/guildRegistry.js';
import { VillageGatekeeperService } from '../services/villageGatekeeperService.js';
import { logger } from '../../logger/index.js';

export async function handleGuildMemberAdd(member) {
  if (member.user.bot) return;

  // 1. Contrôle strict d'accès si le serveur est un des 5 villages
  const gateCheck = await VillageGatekeeperService.checkMemberEntry(member);
  if (!gateCheck.allowed) {
    // Le joueur a été rejeté et expulsé par le gatekeeper
    return;
  }

  // Seuls les 6 serveurs joueurs traitent les arrivées
  if (!GuildRegistry.isPlayerGuild(member.guild.id)) return;

  // 2. Journalisation d'arrivée dans les logs du serveur concerné (uniforme sur les 6 serveurs)
  try {
    await memberLogService.sendMemberJoinLog({ member });
  } catch (error) {
    logger.error(
      { error, memberId: member.id, guildId: member.guild.id },
      'Error handling guildMemberAdd log event'
    );
  }

  // 3. Traitements réservés au serveur communautaire principal (Hyori RP)
  if (GuildRegistry.isCommunityGuild(member.guild.id)) {
    // Contrôle Anti-Raid automatique
    await antiRaidService.handleMemberJoin(member);

    // Auto-Role et Carte de bienvenue
    try {
      const config = await configStore.read().catch(() => ({}));
      const welcome = config.welcome || {};

      if (welcome.autoRoleId) {
        const role = member.guild.roles.cache.get(welcome.autoRoleId);
        if (role) {
          await member.roles
            .add(role, 'Attribution automatique du rôle de bienvenue')
            .catch(err => {
              logger.warn(
                { error: err.message, roleId: welcome.autoRoleId },
                "Impossible d'attribuer l'auto-role"
              );
            });
        }
      }

      if (welcome.enabled !== false && welcome.channelId) {
        const channel =
          member.guild.channels.cache.get(welcome.channelId) ||
          (await member.guild.channels.fetch(welcome.channelId).catch(() => null));

        if (channel && channel.isTextBased()) {
          const cardBuffer = await WelcomeCardService.generateWelcomeCard(member);
          const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-hyori.png' });

          await channel.send({
            content: `Bienvenue sur **Hyori RP**, <@${member.id}> !`,
            files: [attachment],
          });

          logger.info(
            { memberId: member.id, channelId: channel.id },
            'Welcome card sent successfully'
          );
        }
      }
    } catch (error) {
      logger.error({ error, memberId: member.id }, 'Error sending welcome card');
    }
  }
}
