import { authenticateBearer } from '../middleware/auth.js';
import { SyncWhitelistClassSchema, SyncStaffRoleSchema } from '../schemas/routes.schema.js';
import { roleSyncService } from '../../discord/services/roleSyncService.js';
import { logger } from '../../logger/index.js';
export async function roleRoutes(fastify) {
  fastify.addHook('preHandler', authenticateBearer);
  fastify.post('/roles/whitelist-class', async (request, reply) => {
    const parseResult = SyncWhitelistClassSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for whitelist-class sync'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, whitelisted, classRole } = parseResult.data;
    const result = await roleSyncService.syncWhitelistAndClass({
      discordId,
      whitelisted,
      classRole,
    });
    if (!result.success) {
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: 'Role Synchronization Failed',
        message: result.error || 'Failed to synchronize Whitelist/Class roles',
      });
    }
    return reply.status(200).send(result);
  });
  fastify.post('/roles/staff', async (request, reply) => {
    const parseResult = SyncStaffRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn(
        {
          errors: parseResult.error.format(),
        },
        'Invalid payload for staff role sync'
      );
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }
    const { discordId, staffRole } = parseResult.data;
    const result = await roleSyncService.syncStaffRole({
      discordId,
      staffRole,
    });
    if (!result.success) {
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: 'Staff Role Synchronization Failed',
        message: result.error || 'Failed to synchronize Staff role',
      });
    }
    return reply.status(200).send(result);
  });
}
