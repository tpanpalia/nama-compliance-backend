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
import statsRouter from './routes/stats.routes';
import reportsRouter from './routes/reports.routes';
import regulatorsRouter from './routes/regulators.routes';
import { prisma } from './config/database';

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5175')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
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

if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const requestedRole = typeof req.query._role === 'string' ? req.query._role.toLowerCase() : '';
    const roles: Record<string, any> = {
      admin: {
        oid: 'dev-admin-001',
        email: 'admin@nama.om',
        displayName: 'Dev Admin',
        role: 'ADMIN',
        isExternal: false,
      },
      inspector: {
        oid: 'dev-inspector-001',
        email: 'inspector@nama.om',
        displayName: 'Dev Inspector',
        role: 'INSPECTOR',
        isExternal: false,
      },
      contractor: {
        oid: 'dev-contractor-001',
        email: 'contractor@test.com',
        displayName: 'Dev Contractor',
        role: 'CONTRACTOR',
        isExternal: true,
      },
      regulator: {
        oid: 'dev-regulator-001',
        email: 'regulator@apsr.om',
        displayName: 'Dev Regulator',
        role: 'REGULATOR',
        isExternal: true,
      },
    };

    const applyRole = async () => {
      if (requestedRole && roles[requestedRole]) {
        req.user = {
          ...roles[requestedRole],
          dbUserId: roles[requestedRole].oid,
        };
        const activeUser = req.user!;

        if (!activeUser.isExternal) {
          const user = await prisma.user.findFirst({ where: { email: activeUser.email } });
          if (user) activeUser.dbUserId = user.id;
        } else if (activeUser.role === 'CONTRACTOR') {
          const contractor = await prisma.contractor.findFirst({ where: { email: activeUser.email } });
          if (contractor) activeUser.dbUserId = contractor.id;
        } else if (activeUser.role === 'REGULATOR') {
          const regulator = await prisma.regulator.findFirst({ where: { email: activeUser.email } });
          if (regulator) activeUser.dbUserId = regulator.id;
        }
      }
    };

    applyRole().then(() => next()).catch(next);
  });
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1/access-requests', accessRequestsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/work-orders', authenticate, workOrdersRouter);
app.use('/api/v1/evidence', authenticate, evidenceRouter);
app.use('/api/v1/checklists', authenticate, checklistsRouter);
app.use('/api/v1/contractors', authenticate, contractorsRouter);
app.use('/api/v1/sites', authenticate, sitesRouter);
app.use('/api/v1/users', authenticate, usersRouter);
app.use('/api/v1/stats', authenticate, statsRouter);
app.use('/api/v1/reports', authenticate, reportsRouter);
app.use('/api/v1/regulators', authenticate, regulatorsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;
