/* export interface SignupPayload {
    // Identity
    username: string

    // Contact
    email: string
    telephone: string

    // Security
    password: string

    // Optional profile bootstrap
    date_of_birth: string
    nationality_code: string
    occupation: string
} */

import { z } from 'zod';
import { NetworkContext } from '../../../../lib/ops/ops.types';

export const SignupSchema = z.object({
  username:         z.string().min(3).max(30),
  email:            z.string().email(),
  telephone:        z.string().min(10).max(15),
  password:         z.string().min(8),
  date_of_birth:    z.string(),
  nationality_code: z.string().optional().default(""),
  occupation:       z.string().optional().default(""),
});

type SignupPayloadraw = z.infer<typeof SignupSchema>;

export type SignupPayload = SignupPayloadraw & {
  network: NetworkContext;
};