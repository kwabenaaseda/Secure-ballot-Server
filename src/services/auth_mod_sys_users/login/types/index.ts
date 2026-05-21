import {z} from 'zod';

export const LoginSchema = z.object({
    identifier: z.string().min(3, 'Identifier is required'),
    password: z.string().min(1, 'Password is required'),
});

export type LoginPayload = z.infer<typeof LoginSchema>;