import {
  Entity, Column, ManyToOne, JoinColumn, PrimaryColumn
} from 'typeorm';
import { Candidate } from './Candidates';
import { Election } from './Election';

@Entity('vote_tallies')
export class VoteTally {
  @PrimaryColumn({ type: 'uuid' })
  candidate_id: string;

  @PrimaryColumn({ type: 'uuid' })
  election_id: string;

  @ManyToOne(() => Candidate, { nullable: false })
  @JoinColumn({ name: 'candidate_id' })
  candidate: Candidate;

  @ManyToOne(() => Election, { nullable: false })
  @JoinColumn({ name: 'election_id' })
  election: Election;

  @Column({ type: 'integer', default: 0 })
  vote_count: number;
}