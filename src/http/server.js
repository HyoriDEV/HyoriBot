import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '../config/env.js';
import { logger } from '../logger/index.js';
import { healthRoutes } from './routes/health.js';
import { notificationRoutes } from './routes/notifications.js';
import { sanctionRoutes } from './routes/sanctions.js';
import { roleRoutes } from './routes/roles.js';
import { memberRoutes } from './routes/members.js';
export async function createHttpServer() {
  const env = getEnv();
  const fastify = Fastify({
    logger: false,
    disableRequestLogging: true,
  });
  await fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  fastify.addHook('onRequest', async request => {
    logger.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      'Incoming HTTP request'
    );
  });
  fastify.addHook('onResponse', async (request, reply) => {
    logger.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(reply.elapsedTime),
      },
      'HTTP response sent'
    );
  });
  fastify.setErrorHandler((error, request, reply) => {
    logger.error(
      {
        error,
        reqId: request.id,
        url: request.url,
      },
      'Fastify unhandled request error'
    );
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      statusCode,
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });
  fastify.setNotFoundHandler((request, reply) => {
    logger.warn(
      {
        url: request.url,
        method: request.method,
      },
      'Route not found'
    );
    return reply.status(404).send({
      success: false,
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
    });
  });
  await fastify.register(
    async apiV1 => {
      await apiV1.register(healthRoutes);
      await apiV1.register(notificationRoutes);
      await apiV1.register(sanctionRoutes);
      await apiV1.register(roleRoutes);
      await apiV1.register(memberRoutes);
    },
    {
      prefix: '/api/v1',
    }
  );
  return fastify;
}
