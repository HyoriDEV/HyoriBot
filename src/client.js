import path from 'path';
import { fileURLToPath } from 'url';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { loadCommands } from './handlers/commandHandler.js';
import { loadEvents } from './handlers/eventHandler.js';
import { logger } from './logger/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
      ]
    });
  }

  async init() {
    logger.info('Chargement des commandes et événements...');
    const commandsDir = path.resolve(__dirname, 'commands');
    const eventsDir = path.resolve(__dirname, 'events');

    await loadCommands(this.client, commandsDir);
    await loadEvents(this.client, eventsDir);
  }

  async start(token = process.env.DISCORD_BOT_TOKEN) {
    if (!token) {
      throw new Error('DISCORD_BOT_TOKEN manquant dans les variables d\'environnement');
    }
    await this.init();
    await this.client.login(token);
  }

  async stop() {
    if (this.client) {
      this.client.destroy();
      logger.info('Client Discord déconnecté proprement');
    }
  }
}

export const discordBot = new DiscordBot();
