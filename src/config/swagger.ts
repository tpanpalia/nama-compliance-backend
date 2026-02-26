const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'NAMA Compliance Backend API',
    version: '1.0.0',
    description: 'API documentation for NAMA Water Services Compliance Inspection System',
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
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
};

export default swaggerSpec;
