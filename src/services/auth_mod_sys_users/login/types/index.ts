import {z} from 'zod';
import { NetworkContext } from '../../../../lib/ops/ops.types';

export const LoginSchema = z.object({
    identifier: z.string().min(3, 'Identifier is required'),
    password: z.string().min(1, 'Password is required'),
});

type LoginPayloadraw = z.infer<typeof LoginSchema>;

export type LoginPayload = LoginPayloadraw & {
    network: NetworkContext
}