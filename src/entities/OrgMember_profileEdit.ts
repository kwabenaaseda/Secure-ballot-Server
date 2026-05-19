import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
 
@Entity('org_member_profile_edits')
export class OrgMemberProfileEdits {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  org: Organization;
 
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
 
  @Column({ type: 'jsonb' })
  proposed_data: Record<string, any>;
 
  @Column({ type: 'text', nullable: true })
  reason: string;
 
  @Column({ type: 'varchar', default: 'pending' })
  status: string;                  // pending | approved | rejected
 
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewed_by: User;               // Admin who approved/rejected
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
 
  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date;
}
