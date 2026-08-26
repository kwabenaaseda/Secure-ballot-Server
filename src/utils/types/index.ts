import { NetworkContext } from "../../lib/ops/ops.types";

export interface auth_generate_token_payload{
id: string;
email: string;
username:string;
verification:"unverified" | "phone_verified" | "email_verified" | "verified",
user_status: "green" // ALLOW THE USER FREE ENTRY
            |"yellow" // USER ACCOUNT IS UNDER REVIEW (RESTRICT ADMIN AND UPDATE EVENTS)
            |"red",  // FLAGGED ACCOUNT - NO ACCESS
range:  "ACCOUNT_ACCESS[PART]"
/*
        Account_Access[Part] token.
        Issued_by : Incomplete Signup process, Incomplete Login Process
        Reason : OTP verification process failed repeatedly, or user under review
        Role: Allows the user into the room on a read-only access and every action prompts the user to verify account ownership
        Allowed_actions:
                - Explore the app space
                - Search public organizations and read about them
        Dis-allowed_actions:
                - vote submission
                - view account details
                - apply to organizations
                - election room access
                - Creating organization
                - cast vote
                - account details update
                - account deletion
        Users: [voter, organization, system_admin]
 */
| "ACCOUNT_ACCESS[FULL]"
/*
        Account_Access[Full] token.
        Issued_by : complete Signup process, complete Login Process, verified user account status
        Reason : OTP verification process failed repeatedly
        Role: Allows the user into the room on a read and minimal write access. It strictly relegates the user to their account ONLY
        Allowed_actions:
                - Explore the app space
                - Search public organizations and read about them
                - View user account details
                - Apply to join application
                - token renewal
                - token requests
                - combination with other tokens for special action
                - create organizations
        Dis-allowed_actions:
                - vote submission
                - election room access
                - cast vote
                - account details update
                - account deletion
        Users: [voter, organization, system_admin]
 */ 
| "VOTER_ACCESS_PASS[PART]"
/*
        Voter_Access[Part] token.
        Issued_by : User request to participate in a specific election
        Reason : This is purely to ensure that the account owner is the sole person in possession of the device
        Role: Every token is intended to be election specific to allow access to ONE specific election.
        Allowed_actions:
                - Access to specific election event
                - View election results live
                - fill ballot
        Dis-allowed_actions:
                - vote submission
                - view account details
                - apply to organizations
                - Creating organization
                - cast vote
                - account details update
                - account deletion
        Condition: ACCOUNT_ACCESS[FULL] REQUIRED
        Users: [voter, organization, system_admin]
 */ 
| "VOTER_ACCESS_PASS[FULL]"
/*
        Voter_Access_Pass[Full] token.
        Issued_by : Submit vote
        Reason :
                1. A user that has already voted and made its way around the first check will fail here
                2. To ensure the owner is still in possession of the device
        Role: Allows the user to submit a vote.
        Allowed_actions:
                - vote submission
        Dis-allowed_actions:
                - view account details
                - apply to organizations
                - election room access
                - Creating organization
                - account details update
                - account deletion
        Condition: ACCOUNT_ACCESS[FULL] + VOTER_ACCESS_PASS[PART] REQUIRED
        Users: [voter, organization, system_admin]

                */
| "SELF_ACCOUNT_ACCESS"
/*
        SELF_ACCOUNT_ACCESS token.
        Issued_by : Request to mutate user account information
        Reason : To make sure that the user is the one intending to make these changes
        Role: Allows the user to freely edit, update and delete his account.
        Allowed_actions:
                - account details update
                - account deletion
        Dis-allowed_actions:
                - vote submission
                - view account details
                - apply to organizations
                - election room access
                - Creating organization
                - cast vote
                - account details update
                - account deletion
        Condition: ACCOUNT_ACCESS[FULL] REQUIRED
        Users: [voter, organization, system_admin]

                */
|"ORG_ACCESS[PART]"
/*
        ORG_ACCESS[PART] token.
        Issued_by : Request to interact with an org as admin
        Reason : his signs the voter in as an admin to that organization so they can make changes
        Role: Allows the user into the org as an admin
        Allowed_actions:
                - Explore the org space
                - Create elections
                - publish elections
                - verify join requests
        Dis-allowed_actions:
                - Delete organization
                - vote submission
                - view account details
                - apply to organizations
                - election room access
                - Creating organization
                - cast vote
                - account details update
                - account deletion
        Condition: ACCOUNT_ACCESS[FULL] REQUIRED
        Users: [organization]

                */
|"ORG_ACCESS[FULL]"
/*
        ORG_ACCESS[FULL] token.
        Issued_by : Request to interact with an org as owner
        Reason : This signs the voter in as an owner to that organization so they can make changes
        Role: Allows the user into the org as an admin
        Allowed_actions:
                - Explore the org space
                - Create elections
                - publish elections
                - verify join requests
                - Delete organization
                - Change election meta-data
        Dis-allowed_actions:
                - vote submission
                - view account details
                - apply to organizations
                - election room access
                - Creating organization
                - cast vote
                - account details update
                - account deletion
        Condition: ACCOUNT_ACCESS[FULL] REQUIRED
        Users: [organization]
                */
|"SYSTEM_ADMIN"
/*
        System_Admin token.
        Issued_by : Sys_admin Login Process
        Reason : Grants system admin the privileges to oversee the system
        Role: Allows the system in as an avid observer the initiator or final decider on key actions.
        Allowed_actions:
                - Explore the app space
                - Search public organizations and read about them
                - Access to data metrics of organizations
                - Eviction initialization of organization
                - verify and onboard organizations
        Dis-allowed_actions:
                - vote submission
                - view account details
                - apply to organizations
                - election room access
                - Creating organization
                - cast vote
                - account details update
                - account deletion
        Condition: ACCOUNT_ACCESS[FULL] REQUIRED
        Users: [voter, organization, system_admin]

                */
| "NO_ACCESS"
/*
        NO_ACCESS token.
        Issued_by : Any request stage where user is flagged
        Reason : No Access to the system
        Role: NO ACCESS to system
        Allowed_actions:
                - Account recovery process
        Dis-allowed_actions:
                - All system functionality
        Condition: Malicious usage or suspicious activity
        Users: [voter, organization, system_admin]

                */

network: NetworkContext,
data?:{
        election_id?:string,
        org_id?:string,
        org_name?:string,
        election_name?:string,
        election_type?:"public"|"private",
        election_status?:"pending"|"active"|"completed"|"cancelled",
        admin?: "admin" | "super_admin"
}
}

export interface user_profiler{
        // User
        username:string;
        verification_status: "unverified" | "phone_verified" | "email_verified" | "verified";
        user_status: "green" | "yellow" | "red"

        // Org member
        org_role?: "voter"|"moderator"|"admin";
        org_status?: "pending"|"active"|"deactivated";
        org_verified_via?: "email_verified"|"phone_verified"|"custom";
}