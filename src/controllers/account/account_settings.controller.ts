import type { Request, Response } from "express";
import { GetSelf_Operation } from "../../services/account/get_self";
import { RequestMutationOTP_Operation } from "../../services/account/request_mutation_otp";
import { VerifyMutationOTP_Operation } from "../../services/account/verify_mutation_otp";
import { UpdateSelf_Operation } from "../../services/account/update_self";

// ─── GET USER DATA ──────────────────────────────────────────────────────────
export async function GetSelf_Controller(req:Request, res:Response) {
  const network = req.networkContext;
    if (!network) {
        return res.status(400).json({ success: false, message: "Invalid User" });
    }
const user_id = req.user?.id;
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

const result = await GetSelf_Operation({ userId: user_id, network });
    if (!result.success) {
        return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({
        success: true,
        message: result._OPS_MESSAGE,
        data: result._OPS_DATA,
    });
}

// ─── REQUEST MUTATION OTP ──────────────────────────────────────────────────────────
export async function RequestMutationOTP_Controller(req:Request, res:Response) {
    const network = req.networkContext;
    if (!network) {
        return res.status(400).json({ success: false, message: "Invalid User" });
    }
    const user_id = req.user?.id;
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await RequestMutationOTP_Operation({ userId: user_id, network });
    if (!result.success) {
        return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({
        success: true,
        message: result._OPS_MESSAGE,
    });
}


// ─── VERIFY MUTATION OTP ──────────────────────────────────────────────────────────
export async function VerifyMutationOTP_Controller(req:Request, res:Response) {
    const network = req.networkContext;
    if (!network) {
        return res.status(400).json({ success: false, message: "Invalid User" });
    }
    const user_id = req.user?.id;
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { otp } = req.body;
    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required." });
    }

    const result = await VerifyMutationOTP_Operation({ userId: user_id, otp, network });
    if (!result.success) {
        return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({
        success: true,
        message: result._OPS_MESSAGE,
        data: result._OPS_DATA,
    });
}

// ─── UPDATE ACCOUNT ──────────────────────────────────────────────────────────

export async function UpdateSelf_Controller(req:Request, res:Response) {
    const network = req.networkContext;
    if (!network) {
        return res.status(400).json({ success: false, message: "Invalid User" });
    }
    const user_id = req.user?.id;
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const role = req.user?.token?.token_range;
    if (!role) {
        return res.status(400).json({ success: false, message: "Invalid User Role" });
    }
    const updates = req.body;
    if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: "No updates provided." });
    }


    const result = await UpdateSelf_Operation({ userId: user_id, role: role, updates: req.body, network });
    if (!result.success) {
        return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
    }
    return res.status(200).json({
        success: true,
        message: result._OPS_MESSAGE,
        data: result._OPS_DATA,
    });
}

// ─── DELETE ACCOUNT (SOFT) ──────────────────────────────────────────────────────────

export async function DeleteSelf_Controller(req:Request, res:Response) {
    const network = req.networkContext;
    if (!network) {
        return res.status(400).json({ success: false, message: "Invalid User" });
    }
    const user_id = req.user?.id;
    if (!user_id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    res.json({ success: true, message: "DeleteSelf_Controller is not yet implemented." }); 
}