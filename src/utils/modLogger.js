import { DeepAuditLogger } from '../discord/listeners/deepAuditLogger.js';
import { logger } from '../logger/index.js';

/**
 * Envoie un embed dans le salon de logs de modération du serveur concerné.
 * Résout le salon localement de manière uniforme sur tous les serveurs joueurs.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').EmbedBuilder} embed
 */
export async function sendModLog(guild, embed) {
  if (!guild) return;
  try {
    const channel = await DeepAuditLogger.getLogChannel(guild, 'moderation');
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    logger.error({ error, guildId: guild.id }, "Erreur lors de l'envoi du log de modération");
  }
}
