import {
  Entity, Column, ManyToOne, JoinColumn, PrimaryColumn
} from 'typeorm';
import { Candidate } from './Candidates';
import { Election } from './Election';
 
@Entity('vote_tallies')
export class VoteTally {
  @PrimaryColumn({ name: 'candidate_id', type: 'uuid' })
  @ManyToOne(() => Candidate, { nullable: false })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;            // WHO (candidate)
 
  @PrimaryColumn({ name: 'election_id', type: 'uuid' })
  @ManyToOne(() => Election, { nullable: false })
  @JoinColumn({ name: 'election_id' })
  election: Election;              // WHICH election
 
  @Column({ type: 'integer', default: 0 })
  vote_count: number;              // Aggregate only. No user data.
 
  // ⚠️  NO user_id HERE.
  // This table ONLY records counts per candidate.
  // No JOIN between vote_records and vote_tallies
  // can reveal who voted for whom.
}
 
