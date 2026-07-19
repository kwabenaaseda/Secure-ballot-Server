import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Election } from './Election';
 
@Entity('candidates')
export class Candidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Election, { nullable: false })
  @JoinColumn({ name: 'election_id' })
  election: Election;
 
  @Column({ type: 'varchar' })
  fullname: string;
 
  @Column({ type: 'varchar', nullable: true })
  image: string | null;
 
  @Column({ type: 'text', nullable: true })
  summary: string | null;
 
  @Column({ type: 'text', nullable: true })
  manifesto: string | null;
 
  @Column({ type: 'varchar', nullable: true })
  nationality: string | null;
 
  @Column({ type: 'varchar' })
  category: string;                // Which category they're running in
 
  @Column({ type: 'varchar', default: 'pending' })
  vetting_status: string;          // pending | approved | rejected
 
  @Column({ type: 'integer', nullable: true })
  vetting_score: number;
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
