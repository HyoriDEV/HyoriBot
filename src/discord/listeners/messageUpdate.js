import { memberLogService } from '../services/memberLogService.js';
import { GuildRegistry } from '../services/guildRegistry.js';
import { logger } from '../../logger/index.js';

export async function handleMessageUpdate(oldMessage, newMessage) {
  // Ignore DMs and bot messages
  if (!newMessage.guild || newMessage.author?.bot) return;

  if (!GuildRegistry.isPlayerGuild(newMessage.guild.id)) return;

  // Ignore if content didn't change (e.g. embeds loading or pin updates)
  if (oldMessage.content === newMessage.content) return;

  try {
    await memberLogService.sendEditedMessageLog({ oldMessage, newMessage });
  } catch (error) {
    logger.error({ error, messageId: newMessage.id }, 'Error handling messageUpdate event');
  }
}
