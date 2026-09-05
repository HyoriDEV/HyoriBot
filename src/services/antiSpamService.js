import ms from 'ms';
import { EmbedBuilder } from 'discord.js';
import { configStore } from '../storage/index.js';
import { timeoutScheduler } from './timeoutScheduler.js';
import { sendModLog } from '../utils/modLogger.js';
import { logger } from '../logger/index.js';

class AntiSpamService {
  constructor() {
    this.userMessageMap = new Map(); // userId -> Array<timestamp>
  }

  /**
   * Traite un message reçu et sanctionne si le débit dépasse le seuil configuré.
   * @param {import('discord.js').Message} message
   */
  async handleMessage(message) {
    if (message.author.bot || !message.guild || !message.member) return;

    // Ignorer les administrateurs et modérateurs
    if (message.member.permissions.has('Administrator')) return;

    const config = await configStore.read();
    const antiSpamConfig = config.moderation?.antiSpam;
    if (!antiSpamConfig?.enabled) return;

    const now = Date.now();
    const maxMessages = antiSpamConfig.maxMessagesPerInterval || 5;
    const intervalMs = antiSpamConfig.intervalMs || 3000;
    const timeoutDurationStr = antiSpamConfig.timeoutDuration || '10m';

    const userId = message.author.id;
    let timestamps = this.userMessageMap.get(userId) || [];

    // Nettoyage des timestamps hors de l'intervalle glissant
    timestamps = timestamps.filter(t => now - t <= intervalMs);
    timestamps.push(now);
    this.userMessageMap.set(userId, timestamps);

    if (timestamps.length >= maxMessages) {
      // Déclenchement de la sanction
      this.userMessageMap.delete(userId);

      const durationMs = ms(timeoutDurationStr) || 10 * 60 * 1000;
      const reason = `[Système Anti-Spam] Débit excessif : ${timestamps.length} messages en moins de ${intervalMs / 1000}s`;

      try {
        await timeoutScheduler.addTimeout(
          message.guild,
          message.member,
          durationMs,
          reason,
          message.client.user
        );

        // Avertissement temporaire dans le salon
        const warning = await message.channel.send({
          content: `⚠️ ${message.author}, vous avez été sanctionné par l'anti-spam (${timeoutDurationStr}) pour envoi excessif de messages.`
        }).catch(() => null);

        if (warning) {
          setTimeout(() => warning.delete().catch(() => {}), 6000);
        }

        // Log de modération
        const alertEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🚨 Sanction Anti-Spam Automatique')
          .addFields(
            { name: 'Membre', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
            { name: 'Salon', value: `${message.channel}`, inline: true },
            { name: 'Sanction', value: `Timeout customisé (${timeoutDurationStr})`, inline: true },
            { name: 'Raison', value: reason, inline: false }
          )
          .setTimestamp();

        await sendModLog(message.guild, alertEmbed);
        logger.warn({ user: message.author.tag, channel: message.channel.name }, 'Anti-Spam déclenché');
      } catch (err) {
        logger.error({ err, user: message.author.tag }, 'Échec de l\'application de la sanction anti-spam');
      }
    }
  }
}

export const antiSpamService = new AntiSpamService();
