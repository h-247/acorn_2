import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { AppError, ForbiddenError } from './shared/errors.js';
import { config } from './shared/config.js';
import { identityPlugin } from './modules/identity/identity.plugin.js';
import { coursePlugin } from './modules/course/course.plugin.js';
import { taxonomyPlugin } from './modules/taxonomy/taxonomy.plugin.js';
import { materialPlugin } from './modules/material/material.plugin.js';
import { assessmentPlugin } from './modules/assessment/assessment.plugin.js';
import { submissionPlugin } from './modules/submission/submission.plugin.js';
import { evidencePlugin } from './modules/evidence/evidence.plugin.js';
import { learnerStatePlugin } from './modules/learner-state/learner-state.plugin.js';
import { recommendationPlugin } from './modules/recommendation/recommendation.plugin.js';
import { auditPlugin } from './modules/audit/audit.plugin.js';

export function buildApp(): FastifyInstance {
  // Section 07 of the spec asks for request id, actor, route, status and
  // latency on every request, and for tokens and passwords never to appear.
  // Logging was switched off outright, which kept test output clean and left
  // a running service with nothing to look at when something went wrong.
  const app = fastify({
    logger: process.env.NODE_ENV === 'test' ? false : { level: process.env.LOG_LEVEL || 'info' },
    // Fastify's own request/response lines would repeat what the hook below
    // records, without the actor.
    disableRequestLogging: true,
  });

  app.addHook('onResponse', async (request, reply) => {
    if (process.env.NODE_ENV === 'test') return;
    request.log.info(
      {
        // request.log already carries reqId; repeating it here printed the
        // field twice on every line.
        actorId: request.user?.id ?? null,
        actorRole: request.user?.role ?? null,
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
      },
      'request'
    );
  });

  app.register(cors, {
    origin: (origin, cb) => {
      // Deny CORS allowance if no Origin header provided
      if (!origin) {
        cb(null, false);
        return;
      }
      // Only configured WEB_ORIGIN receives credentialed CORS allowance
      if (origin === config.webOrigin) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // Reject cross-origin unsafe mutations using cookie authentication
  app.addHook('preHandler', async (request) => {
    const method = request.method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const rawOrigin = request.headers.origin;
      const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
      if (origin && origin !== config.webOrigin) {
        const authHeader = request.headers.authorization;
        const hasBearer = authHeader && authHeader.startsWith('Bearer ');
        if (!hasBearer && request.headers.cookie) {
          const cookies = request.headers.cookie.split(';');
          for (const c of cookies) {
            const [name, val] = c.trim().split('=');
            if (name === 'acorn_token' && val) {
              throw new ForbiddenError('Cross-origin mutation forbidden');
            }
          }
        }
      }
    }
  });

  app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
    },
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Register domain modules
  app.register(identityPlugin, { prefix: '/api/identity' });
  app.register(coursePlugin, { prefix: '/api' });
  app.register(taxonomyPlugin, { prefix: '/api/taxonomy' });
  app.register(materialPlugin, { prefix: '/api/materials' });
  app.register(assessmentPlugin, { prefix: '/api/assessments' });
  app.register(submissionPlugin, { prefix: '/api/submissions' });
  app.register(evidencePlugin, { prefix: '/api/evidence' });
  app.register(learnerStatePlugin, { prefix: '/api' });
  app.register(recommendationPlugin, { prefix: '/api/recommendations' });
  app.register(auditPlugin, { prefix: '/api/audit' });

  // Central error handler
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: error.errors,
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
      });
    }

    if ((error as any).statusCode && (error as any).statusCode >= 400 && (error as any).statusCode < 500) {
      return reply.status((error as any).statusCode).send({
        code: (error as any).code || 'CLIENT_ERROR',
        message: error.message,
      });
    }

    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
    });
  });

  return app;
}
