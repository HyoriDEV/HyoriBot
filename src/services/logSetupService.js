import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { configStore } from '../storage/index.js';
import { logger } from '../logger/index.js';

export const LOG_TYPES = [
  { id: 'messages_delete', key: 'messagesDeleteChannelId', name: 'Messages Supprimés', channelName: '🗑️・logs-messages-suppr', emoji: '🗑️', desc: 'Messages supprimés avec auteur, salon et contenu' },
  { id: 'messages_edit', key: 'messagesEditChannelId', name: 'Messages Modifiés', channelName: '✏️・logs-messages-modif', emoji: '✏️', desc: 'Historique des messages édités (avant / après)' },
  { id: 'messages_bulk', key: 'messagesBulkChannelId', name: 'Purges Massives (Clear)', channelName: '🧹・logs-purges', emoji: '🧹', desc: 'Suppressions massives via /clear ou /purge' },
  { id: 'members_join_leave', key: 'joinsLeavesChannelId', name: 'Arrivées & Départs', channelName: '📥・logs-arrivées-départs', emoji: '📥', desc: 'Arrivées et départs de membres sur le serveur' },
  { id: 'members_profile', key: 'memberProfileChannelId', name: 'Profils & Surnoms', channelName: '👤・logs-profils-membres', emoji: '👤', desc: 'Changements de pseudos, surnoms et avatars' },
  { id: 'members_roles', key: 'memberRolesChannelId', name: 'Rôles des Membres', channelName: '🛡️・logs-roles-membres', emoji: '🛡️', desc: 'Attributions et retraits de rôles aux membres' },
  { id: 'moderation', key: 'moderationChannelId', name: 'Modération & Sanctions', channelName: '⚖️・logs-moderation', emoji: '⚖️', desc: 'Warns, Timeouts, Mutes, Kicks, Bans, Débans' },
  { id: 'channels', key: 'channelsChannelId', name: 'Salons Serveur', channelName: '📁・logs-salons', emoji: '📁', desc: 'Création, modification et suppression de salons' },
  { id: 'roles', key: 'rolesChannelId', name: 'Rôles Serveur', channelName: '🏷️・logs-roles-serveur', emoji: '🏷️', desc: 'Création, modification et suppression de rôles' },
  { id: 'voice', key: 'voiceChannelId', name: 'Activité Vocale', channelName: '🔊・logs-vocal', emoji: '🔊', desc: 'Connexions, déconnexions et déplacements en vocal' },
  { id: 'server', key: 'serverChannelId', name: 'Serveur & Emojis', channelName: '⚙️・logs-serveur', emoji: '⚙️', desc: 'Paramètres du serveur, bannière, emojis et stickers' },
  { id: 'invites', key: 'invitesChannelId', name: 'Invitations', channelName: '✉️・logs-invitations', emoji: '✉️', desc: 'Création et suppression de liens d\'invitation' }
];

export class LogSetupService {
  /**
   * Crée ou récupère la catégorie dédiée aux logs (privée, invisible @everyone).
   */
  static async getOrCreateLogCategory(guild) {
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && (c.name.includes('LOGS') || c.name.includes('Logs'))
    );

    if (!category) {
      category = await guild.channels.create({
        name: '📁 ─── LOGS SERVEUR ───',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: guild.members.me.id, // Bot
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ],
        reason: 'Création automatique de la catégorie des logs Hyori'
      });
    }

    return category;
  }

  /**
   * Crée ou associe l'ensemble des salons de logs demandés.
   * @param {import('discord.js').Guild} guild
   * @param {string[]} selectedIds - Liste des IDs de logs à créer (tous si null)
   */
  static async setupChannels(guild, selectedIds = null) {
    const targets = selectedIds && selectedIds.length > 0
      ? LOG_TYPES.filter(t => selectedIds.includes(t.id))
      : LOG_TYPES;

    const category = await this.getOrCreateLogCategory(guild);
    const results = [];
    const updatedIds = {};

    for (const logType of targets) {
      try {
        // Vérifie si un salon avec le même nom existe déjà dans la catégorie ou le serveur
        let channel = guild.channels.cache.find(
          c => c.type === ChannelType.GuildText && (
            c.name === logType.channelName ||
            c.name.replace(/[^a-zA-Z0-9-]/g, '') === logType.channelName.replace(/[^a-zA-Z0-9-]/g, '')
          )
        );

        let isNew = false;
        if (!channel) {
          channel = await guild.channels.create({
            name: logType.channelName,
            type: ChannelType.GuildText,
            parent: category.id,
            topic: `${logType.desc} — Géré par Hyori Discord Bot`,
            permissionOverwrites: [
              {
                id: guild.id, // @everyone
                deny: [PermissionFlagsBits.ViewChannel]
              },
              {
                id: guild.members.me.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.EmbedLinks,
                  PermissionFlagsBits.AttachFiles,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              }
            ],
            reason: `Création du salon de logs automatique (${logType.name})`
          });
          isNew = true;

          // Envoi d'un message inaugural dans le nouveau salon
          const initEmbed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`${logType.emoji} Salon Initialisé : ${logType.name}`)
            .setDescription(`Ce salon est désormais configuré pour enregistrer automatiquement tous les événements liés à : **${logType.desc}**.\n\n🔒 *Ce salon est strictement privé et visible uniquement par le Staff.*`)
            .setTimestamp();

          await channel.send({ embeds: [initEmbed] }).catch(() => {});
        } else if (category && channel.parentId !== category.id) {
          // Déplace le salon existant dans la catégorie logs
          await channel.setParent(category.id, { lockPermissions: false }).catch(() => {});
        }

        updatedIds[logType.key] = channel.id;
        results.push({
          logType,
          channel,
          isNew
        });
      } catch (err) {
        logger.error({ err, logType: logType.id }, 'Erreur création salon de logs');
      }
    }

    // Sauvegarde persistante dans config.json
    await configStore.update(data => {
      data.logs = data.logs || {};
      data.logs.categoryChannelId = category.id;
      for (const [k, v] of Object.entries(updatedIds)) {
        data.logs[k] = v;
      }
      // Rétrocompatibilité avec les anciennes clés
      if (updatedIds.messagesDeleteChannelId) data.logs.messagesChannelId = updatedIds.messagesDeleteChannelId;
      if (updatedIds.joinsLeavesChannelId) data.logs.membersChannelId = updatedIds.joinsLeavesChannelId;
      return data;
    });

    return { category, results };
  }

  /**
   * Supprime l'ensemble des salons de logs configurés et leur catégorie.
   */
  static async deleteAllChannels(guild) {
    const config = await configStore.read().catch(() => ({}));
    const logsConfig = config.logs || {};
    let deletedCount = 0;

    for (const logType of LOG_TYPES) {
      const channelId = logsConfig[logType.key];
      if (channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete('Nettoyage des salons de logs Hyori').catch(() => {});
          deletedCount++;
        }
      }
    }

    if (logsConfig.categoryChannelId) {
      const cat = guild.channels.cache.get(logsConfig.categoryChannelId);
      if (cat) {
        await cat.delete('Nettoyage de la catégorie de logs Hyori').catch(() => {});
      }
    }

    await configStore.update(data => {
      data.logs = {};
      return data;
    });

    return deletedCount;
  }
}
