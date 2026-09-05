import { PermissionFlagsBits } from 'discord.js';
import { permissionsStore, configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

export const PERMISSION_LEVELS = {
  0: { name: 'Tout le monde', emoji: '👥', description: 'Accessible par tous les membres' },
  1: { name: 'Membre', emoji: '👤', description: 'Réservé aux membres autorisés (Niveau 1+)' },
  2: { name: 'Modérateur', emoji: '🛡️', description: 'Réservé aux modérateurs / Staff (Niveau 2+)' },
  3: { name: 'Administrateur', emoji: '👑', description: 'Réservé aux administrateurs (Niveau 3)' }
};

export const DEFAULT_COMMAND_LEVELS = {
  // Niveau 0 : Tout le monde (Public)
  help: 0,
  cmds: 0,
  ping: 0,
  userinfo: 0,
  serverinfo: 0,

  // Niveau 2 : Modération & Staff
  warn: 2,
  warnlist: 2,
  clearwarns: 2,
  timeout: 2,
  untimeout: 2,
  tempban: 2,
  untempban: 2,
  to: 2,
  unto: 2,
  tb: 2,
  untb: 2,
  mute: 2,
  unmute: 2,
  clear: 2,
  purge: 2, // Alias de /clear
  lock: 2,
  unlock: 2,
  slowmode: 2,
  kick: 2,

  // Niveau 3 : Administration & Configuration
  ban: 3,
  unban: 3,
  setperm: 3,
  sp: 3,
  spr: 3,
  spl: 2,
  'setperm-cmds': 3,
  'setup-logs': 3,
  'config-logs': 3,
  'config-welcome': 3,
  'configtempban': 3,
  'config-tempban': 3,
  'setup-vocal': 3,
  'setupvocal': 3,
  'config-vocal': 3,
  'jointocreate': 3,
};

const COMMAND_ALIASES = {
  to: 'tempban',
  tb: 'tempban',
  unto: 'untempban',
  untb: 'untempban',
  purge: 'clear',
  commands: 'cmds',
  sp: 'setperm',
  setupvocal: 'setup-vocal',
  'config-vocal': 'setup-vocal',
  jointocreate: 'setup-vocal'
};

export class PermissionService {
  /**
   * Vérifie si un membre a le droit d'exécuter une commande donnée.
   * @param {import('discord.js').GuildMember} member
   * @param {string} commandName
   * @returns {Promise<{ allowed: boolean, reason?: string, userLevel?: number, requiredLevel?: number }>}
   */
  static async canExecute(member, commandName) {
    if (!member || !member.guild) {
      return { allowed: true, userLevel: 3, requiredLevel: 0 };
    }

    // 1. Le propriétaire du serveur a toujours tous les droits (Niveau 3)
    if (member.id === member.guild.ownerId) {
      return { allowed: true, userLevel: 3, requiredLevel: 0 };
    }

    // 2. Administrateur Discord natif a toujours le niveau 3
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) {
      return { allowed: true, userLevel: 3, requiredLevel: 0 };
    }

    const permData = await permissionsStore.read().catch(() => ({ roles: {}, users: {}, commands: {} }));
    const rolesConfig = permData.roles || {};
    const usersConfig = permData.users || {};
    const commandsConfig = permData.commands || {};

    // Déterminer le niveau effectif du membre :
    // a) Niveau attribué directement au membre
    let userLevel = typeof usersConfig[member.id] === 'number' ? usersConfig[member.id] : 0;

    // b) Niveau le plus élevé parmi les rôles du membre
    const memberRoleIds = member.roles?.cache
      ? (typeof member.roles.cache.map === 'function' ? member.roles.cache.map(r => r.id) : Array.from(member.roles.cache.keys()))
      : [];

    for (const roleId of memberRoleIds) {
      if (typeof rolesConfig[roleId] === 'number') {
        if (rolesConfig[roleId] > userLevel) {
          userLevel = rolesConfig[roleId];
        }
      }
    }

    // Rétrocompatibilité Staff : Rôle staff de configStore ou permissions Discord de modération
    if (userLevel < 2) {
      const config = await configStore.read().catch(() => ({ roles: {} }));
      const staffRoleIds = config.roles?.staffRoleIds || [];
      if (
        staffRoleIds.some(id => memberRoleIds.includes(id)) ||
        member.permissions?.has(PermissionFlagsBits.ModerateMembers) ||
        member.permissions?.has(PermissionFlagsBits.ManageMessages)
      ) {
        userLevel = Math.max(userLevel, 2);
      }
    }

    // Niveau requis pour la commande (avec résolution des alias)
    const canonicalName = COMMAND_ALIASES[commandName] || commandName;
    let requiredLevel = 2;

    if (typeof commandsConfig[commandName] === 'number') {
      requiredLevel = commandsConfig[commandName];
    } else if (typeof commandsConfig[canonicalName] === 'number') {
      requiredLevel = commandsConfig[canonicalName];
    } else if (typeof DEFAULT_COMMAND_LEVELS[commandName] === 'number') {
      requiredLevel = DEFAULT_COMMAND_LEVELS[commandName];
    } else if (typeof DEFAULT_COMMAND_LEVELS[canonicalName] === 'number') {
      requiredLevel = DEFAULT_COMMAND_LEVELS[canonicalName];
    }

    if (userLevel >= requiredLevel) {
      return { allowed: true, userLevel, requiredLevel };
    }

    const lvlName = PERMISSION_LEVELS[requiredLevel]?.name || `Niveau ${requiredLevel}`;
    const userLvlName = PERMISSION_LEVELS[userLevel]?.name || `Niveau ${userLevel}`;

    return {
      allowed: false,
      userLevel,
      requiredLevel,
      reason: `Cette commande requiert la permission **${lvlName} (Niveau ${requiredLevel})**. Votre niveau actuel est **${userLvlName} (Niveau ${userLevel})**.`
    };
  }

  /**
   * Assigne le niveau de permission d'un rôle.
   */
  static async setRoleLevel(roleId, level) {
    return permissionsStore.update(data => {
      data.roles = data.roles || {};
      data.roles[roleId] = level;
      return data;
    });
  }

  /**
   * Assigne le niveau de permission d'un membre.
   */
  static async setUserLevel(userId, level) {
    return permissionsStore.update(data => {
      data.users = data.users || {};
      data.users[userId] = level;
      return data;
    });
  }

  /**
   * Assigne le niveau de permission requis pour une commande (gère l'alias clear/purge).
   */
  static async setCommandLevel(commandName, level) {
    return permissionsStore.update(data => {
      data.commands = data.commands || {};
      data.commands[commandName] = level;

      // Synchronisation automatique de l'alias clear/purge
      if (commandName === 'clear') data.commands['purge'] = level;
      if (commandName === 'purge') data.commands['clear'] = level;

      return data;
    });
  }

  /**
   * Supprime un rôle configuré.
   */
  static async removeRoleLevel(roleId) {
    return permissionsStore.update(data => {
      if (data.roles) delete data.roles[roleId];
      return data;
    });
  }

  /**
   * Supprime un membre configuré.
   */
  static async removeUserLevel(userId) {
    return permissionsStore.update(data => {
      if (data.users) delete data.users[userId];
      return data;
    });
  }

  /**
   * Réinitialise toutes les permissions de rôles et membres personnalisées.
   */
  static async resetAll() {
    return permissionsStore.update(data => {
      data.roles = {};
      data.users = {};
      return data;
    });
  }

  /**
   * Récupère la table complète des permissions.
   */
  static async getAllPermissions() {
    const data = await permissionsStore.read().catch(() => ({ roles: {}, users: {}, commands: {} }));
    return {
      roles: data.roles || {},
      users: data.users || {},
      commands: { ...DEFAULT_COMMAND_LEVELS, ...(data.commands || {}) }
    };
  }
}
