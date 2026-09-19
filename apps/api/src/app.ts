import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { AppError } from './shared/errors.js';
import { identityPlugin } from './modules/identity/identity.plugin.js';
import { coursePlugin } from './modules/course/course.plugin.js';
import { taxonomyPlugin } from './modules/taxonomy/taxonomy.plugin.js';
import { materialPlugin } from './modules/material/material.plugin.js';
import { assessmentPlugin } from './modules/assessment/assessment.plugin.js';
import { submissionPlugin } from './modules/submission/submission.plugin.js';
import { evidencePlugin } from './modules/evidence/evidence.plugin.js';
import { learnerStatePlugin } from './modules/learner-state/learner-state.plugin.js';
import { recommendationPlugin } from './modules/recommendation/recommendation.plugin.js';
import { aiPlugin } from './modules/ai/ai.plugin.js';
import { auditPlugin } from './modules/audit/audit.plugin.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: false, // keep clean test output
  });

  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
  app.register(aiPlugin, { prefix: '/api/ai' });
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

    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: error.message || 'Internal server error',
    });
  });

  return app;
}
