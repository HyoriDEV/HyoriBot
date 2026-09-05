import { Events, ActivityType } from 'discord.js';
import { logger } from '../../logger/index.js';
import { timeoutScheduler } from '../../services/timeoutScheduler.js';
import { MuteRoleService } from '../../services/muteRoleService.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(
      {
        tag: client.user.tag,
        id: client.user.id,
        guilds: client.guilds.cache.size,
        users: client.users.cache.size
      },
      `✅ Bot connecté avec succès en tant que ${client.user.tag}`
    );

    client.user.setPresence({
      activities: [
        {
          name: '🛡️ Sécurité & Modération | /help',
          type: ActivityType.Custom
        }
      ],
      status: 'online'
    });

    // 1. Démarrage du scheduler de timeouts persistants
    timeoutScheduler.start(client);

    // 2. Synchronisation des permissions de blacklist sur les guildes
    for (const guild of client.guilds.cache.values()) {
      await MuteRoleService.syncAllBlacklistedChannels(guild).catch(() => {});
    }
  }
};
