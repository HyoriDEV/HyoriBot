import { authenticateBearer } from '../middleware/auth.js';
import { CreateTopicSchema, ArchiveTopicSchema } from '../schemas/routes.schema.js';
import { staffTopicService } from '../../services/staffTopicService.js';
import { logger } from '../../logger/index.js';

export async function topicRoutes(fastify) {
  fastify.addHook('preHandler', authenticateBearer);

  fastify.post('/topics', async (request, reply) => {
    const parseResult = CreateTopicSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Invalid payload for topic creation');
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await staffTopicService.createTopic(parseResult.data);
      return reply.status(201).send(result);
    } catch (error) {
      logger.error({ error }, 'Failed to create topic channel');
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: error.name || 'Internal Server Error',
        message: error.message || 'An unexpected error occurred while creating topic channel',
      });
    }
  });

  fastify.post('/topics/archive', async (request, reply) => {
    const parseResult = ArchiveTopicSchema.safeParse(request.body);
    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Invalid payload for topic archive');
      return reply.status(400).send({
        success: false,
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request payload',
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await staffTopicService.archiveTopic(parseResult.data);
      return reply.send(result);
    } catch (error) {
      logger.error({ error }, 'Failed to archive topic channel');
      return reply.status(500).send({
        success: false,
        statusCode: 500,
        error: error.name || 'Internal Server Error',
        message: error.message || 'An unexpected error occurred while archiving topic channel',
      });
    }
  });
}
