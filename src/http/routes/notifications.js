import { authenticateBearer } from '../middleware/auth.js';
import {
  RegistrationStatusNotificationSchema,
  CharacterSheetStatusNotificationSchema,
  InterviewReminderNotificationSchema,
  SanctionNotificationSchema,
  TicketMessageNotificationSchema,
} from '../schemas/routes.schema.js';
import { notificationService } from '../../discord/services/notificationService.js';
import { logger } from '../../logger/index.js';
export async function notificationRoutes(fastify) {
  fastify.addHook('preHandler', authenticateBearer);
  fastify.post('/notifications/registration-status', async (request, reply) => {
    const parseResult = RegistrationStatusNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for registration-status notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, status, playerSpaceUrl } = parseResult.data;
    const result = await notificationService.notifyRegistrationStatus(
      discordId,
      status,
      playerSpaceUrl
    );
    return reply.status(200).send(result);
  });
  fastify.post('/notifications/character-sheet-status', async (request, reply) => {
    const parseResult = CharacterSheetStatusNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for character-sheet-status notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, status, playerSpaceUrl } = parseResult.data;
    const result = await notificationService.notifyCharacterSheetStatus(
      discordId,
      status,
      playerSpaceUrl
    );
    return reply.status(200).send(result);
  });
  fastify.post('/notifications/sanction', async (request, reply) => {
    const parseResult = SanctionNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for sanction notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, type, reason, duration, appealUrl } = parseResult.data;
    const result = await notificationService.notifySanction(
      discordId,
      type,
      reason,
      duration,
      appealUrl
    );
    return reply.status(200).send(result);
  });
  fastify.post('/notifications/interview-reminder', async (request, reply) => {
    const parseResult = InterviewReminderNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for interview-reminder notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, discordIds, interviewUrl } = parseResult.data;
    const target = discordIds && discordIds.length > 0 ? discordIds : discordId;
    const result = await notificationService.notifyInterviewReminder(target, interviewUrl);
    return reply.status(200).send(result);
  });
  fastify.post('/notifications/ticket-message', async (request, reply) => {
    const parseResult = TicketMessageNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for ticket-message notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const result = await notificationService.notifyTicketMessage(parseResult.data);
    return reply.status(200).send(result);
  });
}
