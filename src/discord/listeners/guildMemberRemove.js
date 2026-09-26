import { memberLogService } from '../services/memberLogService.js';
import { GuildRegistry } from '../services/guildRegistry.js';
import { logger } from '../../logger/index.js';

export async function handleGuildMemberRemove(member) {
  if (member.user?.bot) return;

  // Seuls les 6 serveurs joueurs traitent les départs
  if (!GuildRegistry.isPlayerGuild(member.guild.id)) return;

  try {
    await memberLogService.sendMemberLeaveLog({
      member,
      user: member.user,
      guild: member.guild,
    });
  } catch (error) {
    logger.error(
      { error, memberId: member.id, guildId: member.guild.id },
      'Error handling guildMemberRemove event'
    );
  }
}
