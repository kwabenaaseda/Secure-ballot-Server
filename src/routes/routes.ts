import express from 'express';
import Auth_user from './authentication/mod_sys_user/auth_user.routes';
import Admin_auth_routes from './authentication/mod_sys_admin/admin_auth.routes';
import Admin_routes from './admin/admin_managment.routes';
import Org_routes from './organization/organization.routes';
import Election_routes from './election_management/election.routes';
import Voting_routes from './voting/voting.routes';
import Account_Settings_Routes from './account/account.routes';
import Account_Dashboardd_Routes from './account/account_dashboard.routes';

const ROUTES = express();

// ------------------- AUTHENTICATION
ROUTES.use('/auth/user', Auth_user);
ROUTES.use('/auth/admin', Admin_auth_routes);

// ------------------- SYSTEM ADMIN MANAGEMENT
ROUTES.use('/admin', Admin_routes);

// ------------------- ORGANIZATION
ROUTES.use('/org', Org_routes);

// ------------------- ELECTION MANAGEMENT
ROUTES.use('/election', Election_routes);

// ------------------- VOTING
ROUTES.use('/vote', Voting_routes);

// ------------------- ACCOUNT SETTINGS
ROUTES.use('/account/settings', Account_Settings_Routes);

// ------------------- ACCOUNT DASHBOARD
ROUTES.use('/account', Account_Dashboardd_Routes);

export default ROUTES;
