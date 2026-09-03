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

export class DiscordBotClient {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
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
  get ready() {
    return this.isReady;
  }
}
export const discordBot = new DiscordBotClient();
