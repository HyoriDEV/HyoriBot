import { discordBot } from '../client.js';
import { discordQueue } from '../../queue/discordQueue.js';
import { logger } from '../../logger/index.js';
import {
  buildRegistrationStatusEmbed,
  buildCharacterSheetStatusEmbed,
  buildSanctionNotificationEmbed,
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
  async notifyRegistrationStatus(discordId, status, playerSpaceUrl) {
    if (status === 'NEW' || status === 'WAITLIST') {
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
    const { embed, components } = buildRegistrationStatusEmbed(status, playerSpaceUrl);
    return this.sendDirectMessage(discordId, `notifyRegistrationStatus:${status}`, {
      embeds: [embed],
      components,
    });
  }
  async notifyCharacterSheetStatus(discordId, status, playerSpaceUrl) {
    if (status !== 'PENDING_PLAYER') {
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
    const { embed, components } = buildCharacterSheetStatusEmbed(status, playerSpaceUrl);
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
}
export const notificationService = new NotificationService();
