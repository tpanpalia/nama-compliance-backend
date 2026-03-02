import dotenv from 'dotenv';

dotenv.config();

import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
import { generalRateLimiter } from './config/security';
import { prisma } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/authenticate';
import { sanitizeRequestLogger } from './middleware/sanitizeLogger';
import accessRequestsRouter from './routes/accessRequests.routes';
import authRouter from './routes/auth.routes';
import checklistsRouter from './routes/checklists.routes';
import contractorsRouter from './routes/contractors.routes';
import evidenceRouter from './routes/evidence.routes';
import regulatorsRouter from './routes/regulators.routes';
import reportsRouter from './routes/reports.routes';
import sitesRouter from './routes/sites.routes';
import statsRouter from './routes/stats.routes';
import usersRouter from './routes/users.routes';
import workOrdersRouter from './routes/workOrders.routes';

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeRequestLogger);

morgan.token('sanitized-body', (req: any) => {
  if (!req.sanitizedBody || Object.keys(req.sanitizedBody).length === 0) {
    return '';
  }
  return JSON.stringify(req.sanitizedBody);
});

const morganFormat =
  process.env.NODE_ENV === 'production'
    ? ':remote-addr :method :url :status :res[content-length] :response-time ms'
    : ':method :url :status :response-time ms :sanitized-body';

app.use(morgan(morganFormat));

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.CORS_ORIGIN ||
  'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('/api/', generalRateLimiter);

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
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/regulators', authenticate, regulatorsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;
