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
        SignupRequest: {
          type: 'object',
          required: ['username', 'email', 'telephone', 'password', 'date_of_birth'],
          properties: {
            username: { type: 'string', minLength: 3, maxLength: 30 },
            email: { type: 'string', format: 'email' },
            telephone: { type: 'string' },
            password: { type: 'string', format: 'password', minLength: 8 },
            date_of_birth: { type: 'string', example: '2000-01-15' },
            nationality_code: { type: 'string' },
            occupation: { type: 'string' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['identifier', 'password'],
          properties: {
            identifier: { type: 'string' },
            password: { type: 'string', format: 'password' },
          },
        },
        VerifyOtpRequest: {
          type: 'object',
          required: ['otp'],
          properties: { otp: { type: 'string' } },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['identifier'],
          properties: { identifier: { type: 'string' } },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['new_password'],
          properties: { new_password: { type: 'string', minLength: 8 } },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refresh_token'],
          properties: { refresh_token: { type: 'string' } },
        },
        OnboardAdminRequest: {
          type: 'object',
          required: ['email', 'username', 'level'],
          properties: {
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            level: { type: 'string', enum: ['admin', 'super_admin'] },
          },
        },
        SetUserStatusRequest: {
          type: 'object',
          required: ['user_status'],
          properties: { user_status: { type: 'string', enum: ['green', 'yellow', 'red'] } },
        },
        RejectOrganizationRequest: {
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string' } },
        },
        SuspendOrganizationRequest: {
          type: 'object',
          required: ['reason'],
          properties: { reason: { type: 'string' } },
        },
        UpdateAccountRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            telephone: { type: 'string' },
            username: { type: 'string' },
            date_of_birth: { type: 'string', example: '2000-01-15' },
            nationality: { type: 'string' },
            occupation: { type: 'string' },
            fields_of_interest: { type: 'array', items: { type: 'string' } },
            profile_picture: { type: 'string', format: 'uri' },
          },
        },
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
        CreateOrganizationRequest: {
          type: 'object',
          required: ['name', 'sector', 'email'],
          properties: {
            name: { type: 'string' },
            sector: { type: 'string' },
            email: { type: 'string', format: 'email' },
            company_logo: { type: 'string' },
            website: { type: 'string' },
            location: { type: 'string' },
            description: { type: 'string' },
            established_year: { type: 'integer' },
            visibility: { type: 'string', enum: ['private', 'public'] },
            join_code: { type: 'string' },
            verification_documents: { type: 'array', items: { type: 'string' } },
          },
        },
        VerifyOrgCodeRequest: {
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string' } },
        },
        JoinOrganizationRequest: {
          type: 'object',
          properties: { submitted_data: { type: 'object' } },
        },
        UpdateMemberRoleRequest: {
          type: 'object',
          required: ['role'],
          properties: { role: { type: 'string', enum: ['voter', 'moderator', 'admin'] } },
        },
        UpdateMemberStatusRequest: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', enum: ['active', 'deactivated'] } },
        },
        UploadRosterRequest: {
          type: 'object',
          required: ['csv'],
          properties: {
            csv: { type: 'string' },
            mode: { type: 'string', enum: ['replace', 'append'] },
          },
        },
        CreateElectionRequest: {
          type: 'object',
          required: ['org_id', 'name', 'categories', 'start_at', 'end_at'],
          properties: {
            org_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            summary: { type: 'string' },
            field: { type: 'string' },
            location: { type: 'string' },
            visibility: { type: 'string', enum: ['private', 'public'] },
            is_public: { type: 'boolean' },
            categories: { type: 'array', items: { type: 'string' } },
            start_at: { type: 'string', format: 'date-time' },
            end_at: { type: 'string', format: 'date-time' },
            registration_cutoff_at: { type: 'string', format: 'date-time' },
          },
        },
        AddCandidateRequest: {
          type: 'object',
          required: ['election_id', 'fullname', 'category'],
          properties: {
            election_id: { type: 'string', format: 'uuid' },
            fullname: { type: 'string' },
            category: { type: 'string' },
            image: { type: 'string', format: 'uri' },
            summary: { type: 'string' },
            manifesto: { type: 'string' },
            nationality: { type: 'string' },
          },
        },
        BiometricRegisterFinishRequest: {
          type: 'object',
          required: ['response'],
          properties: {
            response: { type: 'object' },
            device_name: { type: 'string' },
          },
        },
        BiometricAuthStartRequest: {
          type: 'object',
          required: ['purpose'],
          properties: {
            purpose: { type: 'string', enum: ['VOTE', 'ACCOUNT_MUTATE'] },
            resource_id: { type: 'string', format: 'uuid' },
          },
        },
        BiometricAuthFinishRequest: {
          type: 'object',
          required: ['response', 'purpose'],
          properties: {
            response: { type: 'object' },
            purpose: { type: 'string', enum: ['VOTE', 'ACCOUNT_MUTATE'] },
            resource_id: { type: 'string', format: 'uuid' },
          },
        },
        NotificationPrefsRequest: {
          type: 'object',
          properties: {
            notify_election_reminders: { type: 'boolean' },
            notify_approval_updates: { type: 'boolean' },
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
      { name: 'Biometric', description: 'WebAuthn registration and step-up endpoints' },
      { name: 'Notifications', description: 'Notification list and preference endpoints' },
    ],
  },
  apis: ['./src/routes/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
