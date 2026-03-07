import swaggerJSDoc from 'swagger-jsdoc';

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'NAMA Compliance Backend API',
      version: '1.0.0',
      description: 'API documentation for NAMA Water Services Compliance Inspection System',
    },
    servers: [
      {
        url: baseUrl,
        description: 'API server',
      },
    ],
    tags: [
      { name: 'Health' },
      { name: 'Auth' },
      { name: 'Work Orders' },
      { name: 'Evidence' },
      { name: 'Checklists' },
      { name: 'Contractors' },
      { name: 'Sites' },
      { name: 'Users' },
      { name: 'Access Requests' },
      { name: 'Scoring' },
      { name: 'Stats' },
      { name: 'Reports' },
      { name: 'Regulators' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            '200': {
              description: 'Service is healthy',
            },
          },
        },
      },
    },
    components: {
      schemas: {
        WorkOrder: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            reference: { type: 'string', example: 'INS-2026-00001' },
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'INSPECTION_COMPLETED', 'REJECTED', 'REOPENED'],
            },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            isLocked: { type: 'boolean' },
            overallScore: { type: 'number', nullable: true },
            complianceBand: { type: 'string', enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'], nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Contractor: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            contractorId: { type: 'string', example: 'C-00001' },
            companyName: { type: 'string' },
            email: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        Site: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            region: { type: 'string' },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Get token from POST /api/v1/auth/login',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
