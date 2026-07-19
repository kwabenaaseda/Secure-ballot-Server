import {z} from 'zod';

export const ResetSchema = z.object({
    identifier: z.string().min(3, 'Identifier is required'),
});

export type ResetPayload = z.infer<typeof ResetSchema>;