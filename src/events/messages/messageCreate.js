import { Events } from 'discord.js';
import { antiSpamService } from '../../services/antiSpamService.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    // Contrôle Anti-Spam
    await antiSpamService.handleMessage(message);
  }
};
