import { EmbedBuilder } from 'discord.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

/**
 * Envoie un log d'audit vers le salon configuré pour un type spécifique.
 * @param {import('discord.js').Guild} guild
 * @param {'messagesChannelId' | 'membersChannelId' | 'voiceChannelId' | 'moderationChannelId'} channelKey
 * @param {import('discord.js').EmbedBuilder} embed
 */
export async function sendAuditLog(guild, channelKey, embed) {
  try {
    if (!guild) return;

    const config = await configStore.read();
    const channelId = config.logs?.[channelKey];
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) ||
                    await guild.channels.fetch(channelId).catch(() => null);

    if (!channel || !channel.isTextBased()) return;

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    logger.error({ error, channelKey }, 'Erreur lors de l\'envoi du log d\'audit');
  }
}
