import { Request, Response } from "express";
import { z } from "zod";
import { CreateElection_Operation } from "../../services/Election_management/create_election";
import { AddCandidate_Operation } from "../../services/Election_management/add_candidate";

// ─── SCHEMAS ────────────────────────────────────────────────────────────────

const CreateElectionSchema = z.object({
  org_id:                  z.string().uuid(),
  name:                    z.string().min(2).max(160),
  summary:                 z.string().optional(),
  field:                   z.string().optional(),
  location:                z.string().optional(),
  visibility:              z.enum(["private", "public"]).default("private"),
  is_public:               z.boolean().default(false),
  categories:              z.array(z.string()).min(1),
  start_at:                z.string().datetime(),
  end_at:                  z.string().datetime(),
  registration_cutoff_at:  z.string().datetime().optional(),
});

const AddCandidateSchema = z.object({
  election_id:  z.string().uuid(),
  fullname:     z.string().min(2).max(120),
  category:     z.string().min(1),
  image:        z.string().url().optional(),
  summary:      z.string().optional(),
  manifesto:    z.string().optional(),
  nationality:  z.string().optional(),
});

// ─── CREATE ELECTION ──────────────────────────────────────────────────────────

export async function CreateElection_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  if (!network) {
    return res.status(400).json({ success: false, message: "Invalid User" });
  }

  const parsed = CreateElectionSchema.safeParse(req.body);
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

  const result = await CreateElection_Operation({
    ...parsed.data,
    creator_id,
    network,
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

// ─── ADD CANDIDATE ────────────────────────────────────────────────────────────

export async function AddCandidate_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  if (!network) {
    return res.status(400).json({ success: false, message: "Invalid User" });
  }

  const parsed = AddCandidateSchema.safeParse(req.body);
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

  const result = await AddCandidate_Operation({
    ...parsed.data,
    creator_id,
    network,
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