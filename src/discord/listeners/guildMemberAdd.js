import { memberLogService } from '../services/memberLogService.js';
import { logger } from '../../logger/index.js';

export async function handleGuildMemberAdd(member) {
  if (member.user.bot) return;

  try {
    await memberLogService.sendMemberJoinLog({ member });
  } catch (error) {
    logger.error({ error, memberId: member.id }, 'Error handling guildMemberAdd event');
  }
}
