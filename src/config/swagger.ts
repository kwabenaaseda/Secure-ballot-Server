import swaggerJsdoc from 'swagger-jsdoc';
import { ENV } from '../workers/env_validator';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SecureBallot API',
      version: '1.0.0',
      description:
        'A multi-tenant, anonymous electronic voting platform. Capstone thesis project, UENR Computer Engineering.',
      contact: {
        name: 'SecureBallot Team',
        email: 'logosyninc@gmail.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: ENV('API_URL') || 'http://localhost:3000/api/vx',
        description: 'API Server',
      },
    ],
            components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        CastVoteRequest: {
          type: 'object',
          required: ['election_id', 'selections'],
          properties: {
            election_id: { type: 'string', format: 'uuid' },
            selections: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['category', 'candidate_id'],
                properties: {
                  category: { type: 'string' },
                  candidate_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      { name: 'Auth - User', description: 'User authentication endpoints' },
      { name: 'Auth - Admin', description: 'System admin authentication endpoints' },
      { name: 'Account', description: 'Account management endpoints' },
      { name: 'Dashboard', description: 'User dashboard endpoints' },
      { name: 'Organizations', description: 'Organization management endpoints' },
      { name: 'Elections', description: 'Election management endpoints' },
      { name: 'Voting', description: 'Voting endpoints' },
      { name: 'Admin', description: 'System administration endpoints' },
    ],
  },
  apis: ['./src/routes/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
