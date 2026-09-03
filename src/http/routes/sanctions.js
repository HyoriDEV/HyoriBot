import { authenticateBearer } from '../middleware/auth.js';
import { ApplySanctionSchema, RollbackSanctionSchema } from '../schemas/routes.schema.js';
import { sanctionService } from '../../discord/services/sanctionService.js';
import { notificationService } from '../../discord/services/notificationService.js';
import { roleBackupRepository } from '../../persistence/roleBackupRepository.js';
import { logger } from '../../logger/index.js';
export async function sanctionRoutes(fastify) {
  fastify.addHook('preHandler', authenticateBearer);
  fastify.post('/sanctions/apply', async (request, reply) => {
    const parseResult = ApplySanctionSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for apply sanction'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, type, reason, durationSeconds, durationString, notifyDm, metadata } =
      parseResult.data;
    const result = await sanctionService.applySanction({
      discordId,
      type,
      reason,
      durationSeconds,
      metadata,
    });
    if (!result.success) {
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: 'Discord Action Failed',
        message: result.error || 'Failed to apply sanction on Discord',
      });
    }
    let dmNotification = null;
    if (notifyDm) {
      dmNotification = await notificationService.notifySanction(
        discordId,
        type,
        reason,
        durationString || (durationSeconds ? `${Math.round(durationSeconds / 3600)}h` : undefined)
      );
    }
    return reply.status(200).send({
      ...result,
      dmNotification,
    });
  });
  fastify.post('/sanctions/rollback', async (request, reply) => {
    const parseResult = RollbackSanctionSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for rollback sanction'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, backupId, reason } = parseResult.data;
    const result = await sanctionService.rollbackSanction({
      discordId,
      backupId,
      reason,
    });
    if (!result.success) {
      return reply.status(404).send({
        success: false,
        statusCode: 404,
        error: 'Rollback Failed',
        message: result.error || 'Failed to rollback sanction',
      });
    }
    return reply.status(200).send(result);
  });
  fastify.get('/sanctions/backups', async (request, reply) => {
    const { discordId, status } = request.query;
    const backups = await roleBackupRepository.listBackups({
      discordId,
      status,
    });
    return reply.status(200).send({
      success: true,
      count: backups.length,
      backups,
    });
  });
  fastify.get('/sanctions/backups/:id', async (request, reply) => {
    const { id } = request.params;
    const backup = await roleBackupRepository.getBackupById(id);
    if (!backup) {
      return reply.status(404).send({
        success: false,
        statusCode: 404,
        error: 'Not Found',
        message: `Backup with ID ${id} not found`,
      });
    }
    return reply.status(200).send({
      success: true,
      backup,
    });
  });
}
