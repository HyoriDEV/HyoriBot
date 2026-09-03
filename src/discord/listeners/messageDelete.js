import { memberLogService } from '../services/memberLogService.js';
import { logger } from '../../logger/index.js';

export async function handleMessageDelete(message) {
  // Ignore DMs and bot messages
  if (!message.guild || message.author?.bot) return;

  try {
    await memberLogService.sendDeletedMessageLog({ message });
  } catch (error) {
    logger.error({ error, messageId: message.id }, 'Error handling messageDelete event');
  }
}
