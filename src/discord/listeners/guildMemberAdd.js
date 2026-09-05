import { AttachmentBuilder } from 'discord.js';
import { memberLogService } from '../services/memberLogService.js';
import { antiRaidService } from '../../services/antiRaidService.js';
import { WelcomeCardService } from '../../services/welcomeCardService.js';
import { configStore } from '../../storage/index.js';
import { logger } from '../../logger/index.js';

export async function handleGuildMemberAdd(member) {
  if (member.user.bot) return;

  // 1. Contrôle Anti-Raid automatique
  await antiRaidService.handleMemberJoin(member);

  // 2. Journalisation dans les logs d'arrivée
  try {
    await memberLogService.sendMemberJoinLog({ member });
  } catch (error) {
    logger.error({ error, memberId: member.id }, 'Error handling guildMemberAdd log event');
  }

  // 3. Traitement du message et de la carte de bienvenue
  try {
    const config = await configStore.read().catch(() => ({}));
    const welcome = config.welcome || {};

    // Auto-Role si configuré
    if (welcome.autoRoleId) {
      const role = member.guild.roles.cache.get(welcome.autoRoleId);
      if (role) {
        await member.roles.add(role, 'Attribution automatique du rôle de bienvenue').catch(err => {
          logger.warn({ error: err.message, roleId: welcome.autoRoleId }, 'Impossible d\'attribuer l\'auto-role');
        });
      }
    }

    // Envoi de la carte de bienvenue si le salon est configuré et actif
    if (welcome.enabled !== false && welcome.channelId) {
      const channel = member.guild.channels.cache.get(welcome.channelId) ||
                      await member.guild.channels.fetch(welcome.channelId).catch(() => null);

      if (channel && channel.isTextBased()) {
        const cardBuffer = await WelcomeCardService.generateWelcomeCard(member);
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'welcome-hyori.png' });

        await channel.send({
          content: `Bienvenue sur **Hyori RP**, <@${member.id}> !`,
          files: [attachment]
        });

        logger.info({ memberId: member.id, channelId: channel.id }, 'Welcome card sent successfully');
      }
    }
  } catch (error) {
    logger.error({ error, memberId: member.id }, 'Error sending welcome card');
  }
}
