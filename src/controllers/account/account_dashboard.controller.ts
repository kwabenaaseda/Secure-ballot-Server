import { Request, Response } from "express";
import { GetDashboard_Operation } from "../../services/account/get_dashboard";


export async function GetDashboard_Controller(req: Request, res: Response) {
  const network = req.networkContext;
  if (!network) {
    return res.status(400).json({ success: false, message: "Invalid User" });
  }

  const user_id = req.user?.id;
  if (!user_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const result = await GetDashboard_Operation({ userId: user_id, network });
  if (!result.success) {
    return res.status(400).json({ success: false, message: result._OPS_MESSAGE });
  }

  return res.status(200).json({
    success: true,
    message: result._OPS_MESSAGE,
    data: result._OPS_DATA,
  });
}   