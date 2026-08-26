import z from "zod";
import { NetworkContext, AuthContext } from "../../../lib/ops/ops.types";

const CreateOrgPayload = z.object({
  name:          z.string().min(2).max(120),
  sector:        z.string().min(2).max(80),
  email:         z.string().email(),
  company_logo:  z.string().url().optional(),
  visibility:    z.enum(["private", "public"]).default("private"),
  creator_id:    z.string().uuid(),   // authenticated user creating the org
  verification_documents: z.array(z.string()).optional(), // optional, for now
  custom_fields: z.array(z.object({
  key: z.string(), label: z.string(), type: z.enum(["text", "number"]), required: z.boolean(),
})).optional(),
});

 type CreateOrgPayloadType = z.infer<typeof CreateOrgPayload>;

export interface CreateOrganizationPayload extends CreateOrgPayloadType {
  network: NetworkContext;
  auth: AuthContext;         // carried from the requester's existing session
}