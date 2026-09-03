import { discordBot } from '../../discord/client.js';
import { discordQueue } from '../../queue/discordQueue.js';
export async function healthRoutes(fastify) {
  fastify.get('/health', async (request, reply) => {
    const isDiscordReady = discordBot.ready;
    const wsPing = discordBot.client.ws.ping;
    return reply.status(200).send({
      success: true,
      service: 'hyori-discord-bot',
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      discord: {
        ready: isDiscordReady,
        pingMs: wsPing >= 0 ? wsPing : null,
        guildsCached: discordBot.client.guilds.cache.size,
      },
      queue: discordQueue.getStats(),
    });
  });
}
