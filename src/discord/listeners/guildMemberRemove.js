import { memberLogService } from '../services/memberLogService.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../logger/index.js';

export async function handleGuildMemberRemove(member) {
  if (member.user?.bot) return;

  const env = getEnv();
  if (member.guild.id !== env.DISCORD_GUILD_ID) return;

  try {
    await memberLogService.sendMemberLeaveLog({
      member,
      user: member.user,
      guild: member.guild,
    });
  } catch (error) {
    logger.error({ error, memberId: member.id }, 'Error handling guildMemberRemove event');
  }
}
