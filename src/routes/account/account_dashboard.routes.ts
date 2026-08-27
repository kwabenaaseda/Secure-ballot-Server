import { Router } from "express";
import { NetworkContextMiddleware } from "../../middleware/networkContext";
import { AuthMiddleware } from "../../middleware/auth.middleware";
import { GetDashboard_Controller } from "../../controllers/account/account_dashboard.controller";

const Account_Dashboardd_Routes = Router()

Account_Dashboardd_Routes.get('/dashboard', AuthMiddleware, NetworkContextMiddleware, GetDashboard_Controller)