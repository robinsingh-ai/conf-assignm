import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { buildContainer, type Container } from './container';
import { openapi } from './docs/openapi';
import { logger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';
import { accountRouter } from './modules/accounts/account.router';
import { transactionRouter } from './modules/transactions/transaction.router';
import { transferRouter } from './modules/transfers/transfer.router';

/**
 * Builds the Express app without binding a port, so tests can drive it with
 * supertest and the real server can `listen` on it.
 */
export function createApp(container: Container = buildContainer()): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(pinoHttp({ logger, autoLogging: env.NODE_ENV !== 'test' }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try {
      await container.prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down', timestamp: new Date().toISOString() });
    }
  });

  app.get('/openapi.json', (_req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Ledger API' }));

  app.use(accountRouter(container.controllers.accounts));
  app.use(transactionRouter(container.controllers.transactions));
  app.use(transferRouter(container.controllers.transfers));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
