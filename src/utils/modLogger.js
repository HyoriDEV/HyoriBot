import { EmbedBuilder } from 'discord.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

/**
 * Envoie un embed dans le salon de logs de modération configuré.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').EmbedBuilder} embed
 */
export async function sendModLog(guild, embed) {
  try {
    const config = await configStore.read();
    const channelId = config.logs?.moderationChannelId;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (error) {
    logger.error({ error }, 'Erreur lors de l\'envoi du log de modération');
  }
}
