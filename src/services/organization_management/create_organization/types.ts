import z from 'zod';
import { NetworkContext, AuthContext } from '../../../lib/ops/ops.types';

export const CreateOrgPayload = z.object({
  name: z.string().min(2).max(120),
  sector: z.string().min(2).max(80),
  email: z.string().email(),
  company_logo: z.string().trim().min(1).max(500).optional(),
  website: z.string().trim().min(1).max(255).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  established_year: z.number().int().min(1500).max(new Date().getFullYear()).optional(),
  visibility: z.enum(['private', 'public']).default('private'),
  // Required for PRIVATE orgs — members need it to open the join flow.
  join_code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{4,12}$/, 'Passcode must be 4-12 letters, numbers or dashes')
    .optional(),
  // NOTE: creator_id is intentionally NOT in the request-body schema.
  // It is derived server-side from the authenticated session (req.user.id)
  // and injected by the controller, so it only exists on the service payload.
  verification_documents: z.array(z.string()).optional(), // optional, for now
  custom_fields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        type: z.enum(['text', 'number']),
        required: z.boolean(),
      })
    )
    .optional(),
});

type CreateOrgPayloadType = z.infer<typeof CreateOrgPayload>;

export interface CreateOrganizationPayload extends CreateOrgPayloadType {
  // Authenticated user creating the org — derived from the session server-side,
  // never client-supplied. Maps to the Organization.primary_admin relation.
  creator_id: string;
  network: NetworkContext;
  auth: AuthContext; // carried from the requester's existing session
}

export const CreateOrgPayloadStrict = CreateOrgPayload.superRefine((val, ctx) => {
  if (val.visibility === 'private' && !val.join_code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['join_code'],
      message: 'A join passcode is required for private organizations.',
    });
  }
});
