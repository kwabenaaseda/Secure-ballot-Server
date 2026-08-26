import { NetworkContext } from "../../lib/ops/ops.types";
import z from "zod";

export const UpdateSelfRequestSchema = z.object({
  email: z.string().email().optional(),
  telephone: z.string().optional(),
  username: z.string().min(2).max(100).optional(),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nationality: z.string().max(100).optional(),
  occupation: z.string().max(100).optional(),
  fields_of_interest: z.array(z.string()).optional(),
  profile_picture: z.string().url().optional(),
});
export type UpdateSelfRequestPayload = z.infer<typeof UpdateSelfRequestSchema>;

interface RequestMutationOTPRequest {
  userId: string;
  network: NetworkContext;
}

interface VerifyMutationOTPRequest {
  userId: string;
  otp: string;
  network: NetworkContext;
}  

