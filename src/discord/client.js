import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { getEnv } from '../config/env.js';
import { logger } from '../logger/index.js';
import { handleInteractionCreate } from './listeners/interactionCreate.js';
import { handleMessageCreate } from './listeners/messageCreate.js';
import { handleMessageDelete } from './listeners/messageDelete.js';
import { handleMessageUpdate } from './listeners/messageUpdate.js';
import { handleVoiceStateUpdate } from './listeners/voiceStateUpdate.js';
import { handleGuildMemberAdd } from './listeners/guildMemberAdd.js';
import { handleGuildMemberRemove } from './listeners/guildMemberRemove.js';
import { DeepAuditLogger } from './listeners/deepAuditLogger.js';
import { allSlashCommands } from './commands/index.js';

export class DiscordBotClient {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.User, Partials.GuildMember, Partials.Message],
    });
    this.isReady = false;
    this.registerEventHandlers();
  }
  registerEventHandlers() {
    DeepAuditLogger.register(this.client);
    this.client.on(Events.ClientReady, readyClient => {
      this.isReady = true;
      logger.info(
        {
          tag: readyClient.user.tag,
          id: readyClient.user.id,
          guildsCount: readyClient.guilds.cache.size,
        },
        'Discord Bot client is online and ready'
      );
      this.syncAndCleanCommands(readyClient).catch(err => {
        logger.warn({ error: err.message }, 'Erreur lors de la synchronisation des commandes');
      });
    });
    this.client.on(Events.InteractionCreate, async interaction => {
      await handleInteractionCreate(interaction);
    });
    this.client.on(Events.MessageCreate, async message => {
      await handleMessageCreate(message);
    });
    this.client.on(Events.MessageDelete, async message => {
      await handleMessageDelete(message);
    });
    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      await handleMessageUpdate(oldMessage, newMessage);
    });
    this.client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      await handleVoiceStateUpdate(oldState, newState);
    });
    this.client.on(Events.GuildMemberAdd, async member => {
      await handleGuildMemberAdd(member);
    });
    this.client.on(Events.GuildMemberRemove, async member => {
      await handleGuildMemberRemove(member);
    });
    this.client.on(Events.Error, error => {
      logger.error(
        {
          error,
        },
        'Discord client encountered an unhandled error'
      );
    });
    this.client.on(Events.Warn, info => {
      logger.warn(
        {
          info,
        },
        'Discord client warning received'
      );
    });
  }
  async start() {
    const env = getEnv();
    logger.info('Logging into Discord Gateway...');
    await this.client.login(env.DISCORD_BOT_TOKEN);
  }
  async stop() {
    logger.info('Shutting down Discord client connection...');
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (err) {
        logger.error(
          {
            err,
          },
          'Error destroying Discord client'
        );
      }
    }
    this.isReady = false;
  }
  getGuild() {
    const env = getEnv();
    return this.client.guilds.cache.get(env.DISCORD_GUILD_ID) || null;
  }
  async fetchGuild() {
    const env = getEnv();
    const cached = this.getGuild();
    if (cached) return cached;
    const guild = await this.client.guilds.fetch(env.DISCORD_GUILD_ID);
    if (!guild) {
      throw new Error(`Guild with ID ${env.DISCORD_GUILD_ID} not found`);
    }
    return guild;
  }
  async syncAndCleanCommands(readyClient) {
    try {
      logger.info('Vérification et purge automatique des commandes obsolètes sur les serveurs...');
      const validNames = new Set(allSlashCommands.map(c => c.data.name));
      const commandsData = allSlashCommands.map(c => c.data.toJSON());

      // 1. Purge des commandes globales obsolètes
      if (readyClient.application) {
        const globalCmds = await readyClient.application.commands.fetch().catch(() => null);
        if (globalCmds && globalCmds.size > 0) {
          for (const [id, cmd] of globalCmds) {
            if (!validNames.has(cmd.name)) {
              logger.info({ command: cmd.name }, 'Suppression automatique d\'une commande globale obsolète');
              await cmd.delete().catch(() => {});
            }
          }
        }
      }

      // 2. Vérification et purge pour chaque serveur où le bot est présent
      for (const [guildId, guild] of readyClient.guilds.cache) {
        try {
          const guildCmds = await guild.commands.fetch().catch(() => null);
          if (guildCmds && guildCmds.size > 0) {
            for (const [id, cmd] of guildCmds) {
              if (!validNames.has(cmd.name)) {
                logger.info({ guild: guild.name, command: cmd.name }, 'Suppression automatique d\'une commande obsolète sur le serveur');
                await cmd.delete().catch(() => {});
              }
            }
          }

          // Synchronisation des commandes officielles
          await guild.commands.set(commandsData).catch(err => {
            logger.warn({ guild: guild.name, error: err.message }, 'Erreur synchronisation commandes serveur');
          });
          logger.info({ guild: guild.name, count: commandsData.length }, 'Commandes du serveur synchronisées avec succès');
        } catch (err) {
          logger.warn({ guild: guild.name, error: err.message }, 'Erreur traitement commandes sur serveur');
        }
      }
    } catch (err) {
      logger.error({ error: err.message }, 'Erreur lors de la synchronisation automatique des commandes au démarrage');
    }
  }
  get ready() {
    return this.isReady;
  }
}
export const discordBot = new DiscordBotClient();
