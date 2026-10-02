import { authenticateBearer } from '../middleware/auth.js';
import {
  RegistrationStatusNotificationSchema,
  CharacterSheetStatusNotificationSchema,
  InterviewReminderNotificationSchema,
  SanctionNotificationSchema,
  TicketMessageNotificationSchema,
  TicketCreatedNotificationSchema,
  TicketRpSummonedNotificationSchema,
} from '../schemas/routes.schema.js';
import { notificationService } from '../../discord/services/notificationService.js';
import { discordConfig } from '../../config/discordConfig.js';
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
    const { discordId, status, playerSpaceUrl, assignedClass, override } = parseResult.data;
    const result = await notificationService.notifyRegistrationStatus(
      discordId,
      status,
      playerSpaceUrl,
      override,
      assignedClass
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
    const { discordId, status, playerSpaceUrl, override } = parseResult.data;
    const result = await notificationService.notifyCharacterSheetStatus(
      discordId,
      status,
      playerSpaceUrl,
      override
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
    const { discordId, discordIds, interviewUrl, override } = parseResult.data;
    const target = discordIds && discordIds.length > 0 ? discordIds : discordId;
    const result = await notificationService.notifyInterviewReminder(
      target,
      interviewUrl,
      override
    );
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
  fastify.post('/notifications/ticket-created', async (request, reply) => {
    const parseResult = TicketCreatedNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for ticket-created notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const result = await notificationService.notifyTicketCreated(parseResult.data);
    return reply.status(200).send(result);
  });

  fastify.post('/notifications/ticket-rp-summoned', async (request, reply) => {
    const parseResult = TicketRpSummonedNotificationSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for ticket-rp-summoned notification'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const result = await notificationService.notifyTicketRpSummoned(parseResult.data);
    return reply.status(200).send(result);
  });

  fastify.post('/notifications/broadcast-village-invites', async (_request, reply) => {
    try {
      logger.info('Déclenchement de la diffusion des invitations de village par requête API...');
      const result = await notificationService.broadcastVillageInvites();
      return reply.status(200).send(result);
    } catch (error) {
      logger.error({ error }, 'Échec lors de la diffusion des invitations de village');
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: 'Internal Server Error',
        message: error?.message || 'Erreur inattendue lors de la diffusion des invitations',
      });
    }
  });

  fastify.get('/villages', async (_request, reply) => {
    const villages = Object.entries(discordConfig.guilds.villages).map(([key, v]) => ({
      key,
      id: v.id,
      name: v.name,
      class: v.class,
      habitantRoleId: v.habitantRoleId,
      inviteUrl: v.inviteUrl || null,
    }));
    return reply.status(200).send({
      success: true,
      villages,
    });
  });
}
