import { discordBot } from '../client.js';
import { discordQueue } from '../../queue/discordQueue.js';
import { logger } from '../../logger/index.js';
import { discordConfig } from '../../config/discordConfig.js';
import { GuildRegistry } from './guildRegistry.js';
import {
  buildRegistrationStatusEmbed,
  buildVillageInviteNotificationEmbed,
  buildCharacterSheetStatusEmbed,
  buildInterviewReminderEmbed,
  buildSanctionNotificationEmbed,
  buildTicketMessageNotificationEmbed,
  buildTicketCreatedNotificationEmbed,
  buildWaitlistRegistrationNotificationEmbed,
} from '../embeds.js';
export class NotificationService {
  async sendDirectMessage(discordId, actionName, messagePayload) {
    return discordQueue.enqueue(actionName, async () => {
      try {
        const user = await discordBot.client.users.fetch(discordId);
        if (!user) {
          logger.warn(
            {
              discordId,
              actionName,
            },
            'Discord user not found for DM notification'
          );
          return {
            success: false,
            notified: false,
            error: `User with ID ${discordId} not found on Discord`,
          };
        }
        await user.send(messagePayload);
        logger.info(
          {
            discordId,
            userTag: user.tag,
            actionName,
          },
          'DM notification sent successfully'
        );
        return {
          success: true,
          notified: true,
          message: 'Notification sent successfully via DM',
        };
      } catch (error) {
        const isDmDisabled =
          error?.code === 50007 ||
          error?.rawError?.code === 50007 ||
          error?.message?.includes('Cannot send messages to this user');
        if (isDmDisabled) {
          logger.warn(
            {
              discordId,
              actionName,
              errorCode: error?.code,
            },
            'Failed to send DM: Member has DMs disabled or blocked the bot'
          );
          return {
            success: true,
            notified: false,
            dmClosed: true,
            error: 'Direct messages are disabled or the bot is blocked by the user',
          };
        }
        logger.error(
          {
            discordId,
            actionName,
            error,
          },
          'Unexpected error sending DM notification'
        );
        return {
          success: false,
          notified: false,
          error: error?.message || 'Unknown error sending DM',
        };
      }
    });
  }
  async notifyRegistrationStatus(
    discordId,
    status,
    playerSpaceUrl,
    override = null,
    assignedClass = null
  ) {
    if (status === 'NEW') {
      logger.debug(
        {
          discordId,
          status,
        },
        'Registration status requires no notification'
      );
      return {
        success: true,
        notified: false,
        message: `Registration status ${status} does not trigger a notification`,
      };
    }

    let village = null;
    if (status === 'WHITELISTED') {
      let effectiveClass = assignedClass;
      if (!effectiveClass) {
        try {
          const guild = await discordBot.fetchGuild(discordConfig.guilds.community.id);
          const member = await guild.members.fetch(discordId).catch(() => null);
          if (member) {
            for (const [cls, roleId] of Object.entries(discordConfig.roles.classes)) {
              if (roleId && member.roles.cache.has(roleId)) {
                effectiveClass = cls;
                break;
              }
            }
          }
        } catch (err) {
          logger.warn(
            { discordId, error: err.message },
            'Impossible de récupérer la classe Discord pour la notification de whitelist'
          );
        }
      }

      if (effectiveClass) {
        village = GuildRegistry.getVillageByClass(effectiveClass);
      }
    }

    const { embed, components } = buildRegistrationStatusEmbed(
      status,
      playerSpaceUrl,
      override,
      village
    );
    return this.sendDirectMessage(discordId, `notifyRegistrationStatus:${status}`, {
      embeds: [embed],
      components,
    });
  }
  async notifyCharacterSheetStatus(discordId, status, playerSpaceUrl, override = null) {
    const notifyStatuses = ['PENDING_PLAYER', 'VALIDATED', 'REOPENED'];
    if (!notifyStatuses.includes(status)) {
      logger.debug(
        {
          discordId,
          status,
        },
        'Character sheet status requires no notification'
      );
      return {
        success: true,
        notified: false,
        message: `Character sheet status ${status} does not trigger a notification`,
      };
    }
    const { embed, components } = buildCharacterSheetStatusEmbed(status, playerSpaceUrl, override);
    return this.sendDirectMessage(discordId, `notifyCharacterSheetStatus:${status}`, {
      embeds: [embed],
      components,
    });
  }
  async notifySanction(discordId, type, reason, duration, appealUrl) {
    const { embed, components } = buildSanctionNotificationEmbed(type, reason, duration, appealUrl);
    return this.sendDirectMessage(discordId, `notifySanction:${type}`, {
      embeds: [embed],
      components,
    });
  }
  async notifyInterviewReminder(target, interviewUrl, override = null) {
    const discordIds = Array.isArray(target) ? target : [target];
    const { embed, components } = buildInterviewReminderEmbed(interviewUrl, override);

    let sent = 0;
    let failed = 0;
    let dmClosed = 0;
    const errors = [];

    const results = await Promise.allSettled(
      discordIds.map(discordId =>
        this.sendDirectMessage(discordId, 'notifyInterviewReminder', {
          embeds: [embed],
          components,
        })
      )
    );

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const discordId = discordIds[i];
      if (res.status === 'fulfilled') {
        if (res.value.success && res.value.notified) {
          sent++;
        } else if (res.value.dmClosed) {
          dmClosed++;
        } else {
          failed++;
          if (res.value.error) errors.push(`${discordId}: ${res.value.error}`);
        }
      } else {
        failed++;
        errors.push(`${discordId}: ${res.reason?.message || 'Unknown error'}`);
      }
    }

    logger.info(
      {
        total: discordIds.length,
        sent,
        dmClosed,
        failed,
      },
      'Completed interview reminder notifications batch'
    );

    return {
      success: true,
      total: discordIds.length,
      sent,
      dmClosed,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
  async notifyTicketMessage({
    discordId,
    ticketId,
    ticketSubject,
    authorName,
    messagePreview,
    ticketUrl,
    override = null,
  }) {
    const { embed, components } = buildTicketMessageNotificationEmbed(
      ticketSubject,
      authorName,
      messagePreview,
      ticketUrl,
      override
    );
    return this.sendDirectMessage(discordId, `notifyTicketMessage:${ticketId}`, {
      embeds: [embed],
      components,
    });
  }
  async notifyTicketCreated({ channelId, mentionRoleId, ...ticket }) {
    return this.sendTicketChannelNotification({
      label: 'ticket-created',
      targetChannelId: channelId || discordConfig.channels.ticketNotifications,
      roleId: mentionRoleId || discordConfig.roles.ticketMention,
      ticket,
    });
  }

  /**
   * Transmet un ticket à une équipe sur son salon dédié. L'embed est celui d'une ouverture de
   * ticket, et aucun repli sur le salon tickets général n'est fait : sans salon configuré pour
   * l'équipe, rien n'est envoyé.
   */
  async notifyTicketTeamSummoned({ team, channelId, mentionRoleId, ...ticket }) {
    return this.sendTicketChannelNotification({
      label: `ticket-team-summoned:${team}`,
      targetChannelId: channelId || discordConfig.channels.ticketTeamNotifications[team],
      roleId: mentionRoleId || discordConfig.roles.ticketTeamMention[team],
      ticket,
    });
  }

  async sendTicketChannelNotification({ label, targetChannelId, roleId, ticket }) {
    const {
      ticketId,
      ticketSubject,
      ticketCategory,
      authorName,
      ticketDescription,
      ticketStaffUrl,
      override = null,
    } = ticket;

    if (!targetChannelId) {
      logger.warn({ ticketId }, `No channel configured for ${label} notification`);
      return {
        success: false,
        notified: false,
        error: `No target channel configured for ${label} notification`,
      };
    }

    return discordQueue.enqueue(`${label}:${ticketId}`, async () => {
      try {
        const channel = await discordBot.client.channels.fetch(targetChannelId);
        if (!channel || !channel.isTextBased()) {
          logger.warn(
            { targetChannelId, ticketId },
            `Target channel not found or not text-based for ${label} notification`
          );
          return {
            success: false,
            notified: false,
            error: `Target channel ${targetChannelId} not found or not text-based`,
          };
        }

        const { embed, components } = buildTicketCreatedNotificationEmbed({
          ticketSubject,
          ticketCategory,
          authorName,
          ticketDescription,
          ticketStaffUrl,
          override,
        });

        const content = roleId ? `<@&${roleId}>` : undefined;

        await channel.send({
          content,
          embeds: [embed],
          components,
        });

        logger.info(
          { targetChannelId, ticketId, roleId },
          `${label} notification sent successfully to channel`
        );

        return {
          success: true,
          notified: true,
          message: `${label} notification sent successfully to channel`,
        };
      } catch (error) {
        logger.error(
          { targetChannelId, ticketId, error },
          `Failed to send ${label} notification to channel`
        );
        return {
          success: false,
          notified: false,
          error: error?.message || 'Failed to send message to Discord channel',
        };
      }
    });
  }

  /**
   * Notifie les administrateurs sur le salon Discord dédié du serveur staff
   * lors de l'inscription d'un nouveau joueur sur la liste d'attente.
   */
  async notifyWaitlistRegistration({
    channelId,
    mentionRoleId,
    discordId,
    playerName,
    minecraftUsername,
    minecraftUuid,
    avatarUrl,
    waitlistStaffUrl,
    override = null,
  }) {
    const targetChannelId = channelId || discordConfig.channels.waitlistNotifications;
    const roleId =
      mentionRoleId !== undefined ? mentionRoleId : discordConfig.roles.waitlistMention;

    if (!targetChannelId) {
      logger.warn('No channel configured for waitlist-registration notification');
      return {
        success: false,
        notified: false,
        error: 'No target channel configured for waitlist-registration notification',
      };
    }

    const queueKey = `waitlist-registration:${discordId || playerName || Date.now()}`;
    return discordQueue.enqueue(queueKey, async () => {
      try {
        const channel = await discordBot.client.channels.fetch(targetChannelId);
        if (!channel || !channel.isTextBased()) {
          logger.warn(
            { targetChannelId },
            'Target channel not found or not text-based for waitlist-registration notification'
          );
          return {
            success: false,
            notified: false,
            error: `Target channel ${targetChannelId} not found or not text-based`,
          };
        }

        let effectiveAvatarUrl = avatarUrl;
        if (!effectiveAvatarUrl && discordId) {
          try {
            const user = await discordBot.client.users.fetch(discordId);
            if (user) {
              effectiveAvatarUrl = user.displayAvatarURL({ size: 256 });
            }
          } catch {
            // Non bloquant
          }
        }

        const { embed, components } = buildWaitlistRegistrationNotificationEmbed({
          playerName,
          minecraftUsername,
          discordId,
          waitlistStaffUrl,
          avatarUrl: effectiveAvatarUrl,
          override,
        });

        const content = roleId ? `<@&${roleId}>` : undefined;

        await channel.send({
          content,
          embeds: [embed],
          components,
        });

        logger.info(
          { targetChannelId, playerName, roleId },
          'Waitlist registration notification sent successfully to channel'
        );

        return {
          success: true,
          notified: true,
          message: 'Waitlist registration notification sent successfully to channel',
        };
      } catch (error) {
        logger.error(
          { targetChannelId, error },
          'Failed to send waitlist-registration notification to channel'
        );
        return {
          success: false,
          notified: false,
          error: error?.message || 'Failed to send message to Discord channel',
        };
      }
    });
  }

  /**
   * Envoie automatiquement un message privé via HyoriBot à tous les joueurs ayant le rôle Whitelist
   * sur le serveur communautaire Hyori RP, contenant le lien d'invitation permanent vers le serveur
   * Discord de la classe leur étant attribuée.
   */
  async broadcastVillageInvites() {
    const communityGuildId = discordConfig.guilds.community.id;
    if (!communityGuildId) {
      throw new Error(
        'Identifiant du serveur communautaire (community.id) non configuré dans discordConfig'
      );
    }

    const guild = await discordBot.fetchGuild(communityGuildId);
    if (!guild) {
      throw new Error(`Serveur communautaire avec l'ID ${communityGuildId} introuvable`);
    }

    logger.info(
      { guildId: communityGuildId },
      'Récupération de tous les membres du serveur communautaire pour la diffusion...'
    );
    const allMembers = await guild.members.fetch();

    const whitelistRoleId = discordConfig.roles.whitelist;
    if (!whitelistRoleId) {
      throw new Error('Rôle whitelist non configuré dans discordConfig.roles.whitelist');
    }

    const whitelistedMembers = allMembers.filter(
      member => !member.user.bot && member.roles.cache.has(whitelistRoleId)
    );

    logger.info(
      { totalMembers: allMembers.size, whitelistedCount: whitelistedMembers.size },
      'Membres whitelistés détectés sur le serveur communautaire'
    );

    const stats = {
      totalWhitelisted: whitelistedMembers.size,
      sent: 0,
      dmClosed: 0,
      failed: 0,
      noClassRole: 0,
      byClass: {
        NOBLE: 0,
        PECHEUR: 0,
        PAYSAN: 0,
        MINEUR: 0,
        ERUDIT: 0,
      },
      skipped: [],
      errors: [],
    };

    if (whitelistedMembers.size === 0) {
      return {
        success: true,
        summary: stats,
        message: 'Aucun membre whitelisté trouvé sur le serveur communautaire.',
      };
    }

    const classRoleEntries = Object.entries(discordConfig.roles.classes);
    const sendTasks = [];

    for (const member of whitelistedMembers.values()) {
      let memberClass = null;
      for (const [cls, roleId] of classRoleEntries) {
        if (roleId && member.roles.cache.has(roleId)) {
          memberClass = cls;
          break;
        }
      }

      if (!memberClass) {
        stats.noClassRole++;
        stats.skipped.push({
          discordId: member.id,
          username: member.user.tag,
          displayName: member.displayName,
          reason: 'Aucun rôle de classe attribué sur le serveur communautaire',
        });
        continue;
      }

      const village = GuildRegistry.getVillageByClass(memberClass);
      if (!village || !village.inviteUrl) {
        stats.failed++;
        stats.skipped.push({
          discordId: member.id,
          username: member.user.tag,
          displayName: member.displayName,
          class: memberClass,
          reason: `Lien d'invitation non configuré pour la classe ${memberClass}`,
        });
        continue;
      }

      const { embed, components } = buildVillageInviteNotificationEmbed({
        village,
        memberName: member.displayName || member.user.username,
      });

      sendTasks.push(
        (async () => {
          try {
            const res = await this.sendDirectMessage(
              member.id,
              `villageInvite:${memberClass}:${member.id}`,
              {
                embeds: [embed],
                components,
              }
            );

            if (res.success && res.notified) {
              stats.sent++;
              stats.byClass[memberClass] = (stats.byClass[memberClass] || 0) + 1;
            } else if (res.dmClosed) {
              stats.dmClosed++;
            } else {
              stats.failed++;
              if (res.error) {
                stats.errors.push(`${member.user.tag}: ${res.error}`);
              }
            }
          } catch (err) {
            stats.failed++;
            stats.errors.push(`${member.user.tag}: ${err.message}`);
          }
        })()
      );
    }

    await Promise.all(sendTasks);

    logger.info(
      {
        totalWhitelisted: stats.totalWhitelisted,
        sent: stats.sent,
        dmClosed: stats.dmClosed,
        noClassRole: stats.noClassRole,
        failed: stats.failed,
      },
      'Diffusion des invitations de village terminée'
    );

    return {
      success: true,
      summary: stats,
      message: `${stats.sent} invitation(s) envoyée(s) avec succès sur ${stats.totalWhitelisted} joueur(s) whitelisté(s).`,
    };
  }
}
export const notificationService = new NotificationService();
