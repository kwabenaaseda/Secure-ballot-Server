import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn
} from 'typeorm';
import { Election } from './Election';
 
@Entity('cold_store')
export class ColdStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Election, { nullable: false })
  @JoinColumn({ name: 'election_id' })
  election: Election;
 
  @Column({ type: 'varchar' })
  election_name: string;
 
  @Column({ type: 'varchar', nullable: true })
  field: string;
 
  @Column({ type: 'varchar', nullable: true })
  icon: string;
 
  @Column({ type: 'integer' })
  total_votes: number;
 
  @Column({ type: 'jsonb', nullable: true })
  winner_per_category: Record<string, any>;
 
  @Column({ type: 'jsonb' })
  full_results: Record<string, any>;
 
  @Column({ type: 'timestamptz', nullable: true })
  computed_at: Date;
 
  @Column({ type: 'boolean', default: false })
  is_final: boolean;
}
