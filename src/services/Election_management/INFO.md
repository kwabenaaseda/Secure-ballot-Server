# #MODULE : ELECTION MANAGEMENT

```
This module aims to handle Election events only. Its purpose is to self as a 
self auditing creator agnostic system
```

## WHAT IS AN ELECTION
An _Election_ is an event that provides data and information such as candidate information, organizational sources and tally sub-systems to allow the users to vote.

Our Election instances are self contained and take form around the creator's specificiations.

The election instance has an automated audit trail.

## Feature Listing
__PHASE ZERO__
1. Creator can __CREATE__ an election process
2. Creator can __UPDATE__ an election process
3. Creator can __MANAGE ELECTION STATE__ through __DRAFT -> LIVE -> CONCLUDED / CLOSED -> ARCHIVED / DELETED__
4. Election logs audit events

__ELECTION STRUCUTRE__

id: string;
org: Organization; <-- Contention point (This implies only organizations can create elections)
name: string;
summary: string;
field: string;
location: string;
visibility: string;              // private | public
is_public: boolean;              // If true, anyone can vote (no membership required)
scope: string;
icon: string;
status: string;                  // draft | published | closed | archived
categories: any[];               // Election categories (e.g. ['President', 'VP'])
start_at: Date;
end_at: Date;
registration_cutoff_at: Date;
created_at: Date;

