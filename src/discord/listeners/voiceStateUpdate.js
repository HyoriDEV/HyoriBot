import { memberLogService } from '../services/memberLogService.js';
import { tempVoiceService } from '../../services/tempVoiceService.js';
import { logger } from '../../logger/index.js';

export async function handleVoiceStateUpdate(oldState, newState) {
  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  const guild = newState.guild || oldState.guild;
  const oldChannel = oldState.channel;
  const newChannel = newState.channel;

  // Gestion des salons vocaux temporaires (Join to Create et auto-suppression quand vide)
  try {
    await tempVoiceService.handleVoiceStateUpdate(oldState, newState);
  } catch (err) {
    logger.error({ error: err.message }, 'Erreur dans tempVoiceService.handleVoiceStateUpdate');
  }

  // Case 1: Member joined a voice channel
  if (!oldChannel && newChannel) {
    try {
      await memberLogService.sendVoiceStateLog({
        guild,
        member,
        action: 'JOIN',
        oldChannel: null,
        newChannel,
      });
    } catch (error) {
      logger.error({ error, memberId: member.id }, 'Error logging voice join');
    }
    return;
  }

  // Case 2: Member left a voice channel
  if (oldChannel && !newChannel) {
    try {
      await memberLogService.sendVoiceStateLog({
        guild,
        member,
        action: 'LEAVE',
        oldChannel,
        newChannel: null,
      });
    } catch (error) {
      logger.error({ error, memberId: member.id }, 'Error logging voice leave');
    }
    return;
  }

  // Case 3: Member switched voice channels
  if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
    try {
      await memberLogService.sendVoiceStateLog({
        guild,
        member,
        action: 'SWITCH',
        oldChannel,
        newChannel,
      });
    } catch (error) {
      logger.error({ error, memberId: member.id }, 'Error logging voice switch');
    }
  }
}
