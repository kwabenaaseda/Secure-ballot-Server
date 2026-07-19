import { Request, Response } from "express";
import { z } from "zod";
import { CreateOrganization_Operation } from "../../services/organization_management/create_organization";

const CreateOrganizationSchema = z.object({
  name:          z.string().min(2).max(120),
  sector:        z.string().min(2).max(80),
  email:         z.string().email(),
  company_logo:  z.string().url().optional(),
  visibility:    z.enum(["private", "public"]).default("private"),
});

export async function CreateOrganization_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  if (!network) {
    return res.status(400).json({ success: false, message: "Invalid User" });
  }

  const parsed = CreateOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const creator_id = req.user?.id;
  if (!creator_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const result = await CreateOrganization_Operation({
    ...parsed.data,
    creator_id,
    network,
    // Placeholder until real auth-factor propagation exists — see types.ts note
    auth: { factors_used: ["JWT"], confidence: 1.0, mfa_verified: false },
  });

  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(201).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}