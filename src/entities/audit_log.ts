import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { User } from './User';
 
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User;                     // Who performed the action
 
  @Column({ type: 'varchar' })
  action: string;                  // e.g. 'CAST_VOTE', 'CREATE_ELECTION', 'LOGIN'
 
  @Column({ type: 'uuid', nullable: true })
  target_id: string;               // ID of the affected resource
 
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;   // Additional context
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
