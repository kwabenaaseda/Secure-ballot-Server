import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Unique
} from 'typeorm';
import { User } from './User';
import { Election } from './Election';
 
@Entity('vote_records')
@Unique(['user', 'election'])      // One vote per user per election
export class VoteRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;                      // WHO voted (participation only)
 
  @ManyToOne(() => Election, { nullable: false })
  @JoinColumn({ name: 'election_id' })
  election: Election;              // WHICH election
 
  @CreateDateColumn({ type: 'timestamptz' })
  voted_at: Date;
 
  // ⚠️  NO candidate_id HERE.
  // This table ONLY records participation.
  // WHO voted for WHOM is unknowable by design.
}
