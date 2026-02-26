import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { authenticate } from './middleware/authenticate';
import { errorHandler } from './middleware/errorHandler';
import logger from './config/logger';
import swaggerSpec from './config/swagger';
import authRouter from './routes/auth.routes';
import workOrdersRouter from './routes/workOrders.routes';
import evidenceRouter from './routes/evidence.routes';
import checklistsRouter from './routes/checklists.routes';
import contractorsRouter from './routes/contractors.routes';
import sitesRouter from './routes/sites.routes';
import usersRouter from './routes/users.routes';
import accessRequestsRouter from './routes/accessRequests.routes';
import scoringRouter from './routes/scoring.routes';
import statsRouter from './routes/stats.routes';
import reportsRouter from './routes/reports.routes';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' },
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1/access-requests', accessRequestsRouter);

app.use('/api/v1', authenticate);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/work-orders', workOrdersRouter);
app.use('/api/v1/evidence', evidenceRouter);
app.use('/api/v1/checklists', checklistsRouter);
app.use('/api/v1/contractors', contractorsRouter);
app.use('/api/v1/sites', sitesRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/scoring', scoringRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/reports', reportsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;
