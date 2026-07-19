import { Request, Response } from "express";
import { z } from "zod";
import { CastVote_Operation } from "../../services/Voting_service/cast_vote";

const CastVoteSchema = z.object({
  election_id:  z.string().uuid(),
  candidate_id: z.string().uuid(),
});

export async function CastVote_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  if (!network) {
    return res.status(400).json({ success: false, message: "Invalid User" });
  }

  const parsed = CastVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid input",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const voter_id = req.user?.id;
  if (!voter_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const result = await CastVote_Operation({
    ...parsed.data,
    voter_id,
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