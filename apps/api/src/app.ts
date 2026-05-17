import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { authPlugin } from './plugins/auth.plugin';
import { leadsRoutes } from './routes/leads/leads.routes';
import { dealsRoutes } from './routes/deals/deals.routes';
import { outreachRoutes } from './routes/outreach/outreach.routes';
import { proposalsRoutes } from './routes/proposals/proposals.routes';
import { analyticsRoutes } from './routes/analytics/analytics.routes';
import { adminRoutes } from './routes/admin/admin.routes';
import { emailRoutes } from './routes/email/email.routes';
import { cronRoutes } from './routes/cron/cron.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Too many requests, please slow down.',
      code: 'RATE_LIMIT_EXCEEDED',
    }),
  });

  await app.register(authPlugin);

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  await app.register(
    async (v1) => {
      await v1.register(leadsRoutes, { prefix: '/leads' });
      await v1.register(dealsRoutes, { prefix: '/deals' });
      await v1.register(outreachRoutes, { prefix: '' });
      await v1.register(proposalsRoutes, { prefix: '/proposals' });
      await v1.register(analyticsRoutes, { prefix: '/analytics' });
      await v1.register(adminRoutes, { prefix: '/admin' });
      await v1.register(emailRoutes, { prefix: '' });
      await v1.register(cronRoutes, { prefix: '' });
    },
    { prefix: '/api/v1' },
  );

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    if (error.statusCode === 429) {
      return reply.status(429).send({ error: error.message, code: 'RATE_LIMIT_EXCEEDED' });
    }
    if (error.validation) {
      return reply.status(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      });
    }
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error:
        process.env['NODE_ENV'] === 'production' && statusCode === 500
          ? 'Internal server error'
          : error.message,
      code: 'INTERNAL_ERROR',
    });
  });

  return app;
}
