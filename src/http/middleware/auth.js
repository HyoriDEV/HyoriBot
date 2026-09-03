import { getEnv } from '../../config/env.js';
import { logger } from '../../logger/index.js';
export async function authenticateBearer(request, reply) {
  const env = getEnv();
  const authHeader = request.headers.authorization;
  if (!authHeader) {
    logger.warn(
      {
        ip: request.ip,
        url: request.url,
      },
      'Missing Authorization header in request'
    );
    return reply.status(401).send({
      success: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authorization header is required (Format: Bearer <INTERNAL_BOT_API_KEY>)',
    });
  }
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    logger.warn(
      {
        ip: request.ip,
        url: request.url,
      },
      'Invalid Authorization header format'
    );
    return reply.status(401).send({
      success: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected Bearer <INTERNAL_BOT_API_KEY>',
    });
  }
  const token = parts[1];
  if (token !== env.INTERNAL_BOT_API_KEY) {
    logger.warn(
      {
        ip: request.ip,
        url: request.url,
      },
      'Invalid API key provided in Bearer auth'
    );
    return reply.status(401).send({
      success: false,
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid API key provided',
    });
  }
}
