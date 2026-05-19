import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';
 
@Entity('org_member_profiles')
export class OrgMemberProfiles {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  org: Organization;
 
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
 
  @Column({ type: 'jsonb' })
  custom_data: Record<string, any>; // Answers to org's custom_fields
 
  @Column({ type: 'integer', default: 1 })
  version: number;                  // Matches OrganizationAuth.schema_version
 
  @Column({ type: 'timestamptz', nullable: true })
  submitted_at: Date;
 
  @Column({ type: 'timestamptz', nullable: true })
  updated_at: Date;
}
