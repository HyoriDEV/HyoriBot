import path from 'path';
import { fileURLToPath } from 'url';
import { JsonStore } from './jsonStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../data');

export const configStore = new JsonStore(path.join(DATA_DIR, 'config.json'), {
  guildId: '',
  prefix: '!',
  roles: {
    mutedRoleId: '',
    staffRoleIds: [],
    levelRewards: {}
  },
  moderation: {
    blacklistedChannels: [],
    antiSpam: {
      enabled: true,
      maxMessagesPerInterval: 5,
      intervalMs: 3000,
      action: 'timeout',
      timeoutDuration: '10m'
    },
    antiRaid: {
      enabled: true,
      joinThreshold: 10,
      intervalSeconds: 10
    }
  },
  logs: {
    messagesChannelId: '',
    membersChannelId: '',
    voiceChannelId: '',
    moderationChannelId: ''
  },
  tickets: {
    categoryId: '',
    transcriptFormat: 'txt'
  },
  levels: {
    cooldownSeconds: 60,
    xpPerMessage: { min: 15, max: 25 },
    xpPerVoiceMinute: 10
  }
});

export const timeoutsStore = new JsonStore(path.join(DATA_DIR, 'timeouts.json'), {
  version: 1,
  activeTimeouts: []
});

export const warnsStore = new JsonStore(path.join(DATA_DIR, 'warns.json'), {
  version: 1,
  sanctions: []
});

export const buttonRolesStore = new JsonStore(path.join(DATA_DIR, 'buttonRoles.json'), {
  version: 1,
  panels: []
});

export const ticketsStore = new JsonStore(path.join(DATA_DIR, 'tickets.json'), {
  version: 1,
  ticketCounter: 0,
  tickets: []
});

export const permissionsStore = new JsonStore(path.join(DATA_DIR, 'permissions.json'), {
  version: 1,
  commands: {}
});

export { DATA_DIR };

