import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
 
@Entity('organization_auth')
export class OrganizationAuth {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  org: Organization;               // UNIQUE per org (one auth schema per org)
 
  @Column({ type: 'jsonb' })
  custom_fields: Record<string, any>; // Field definitions for self-registration
 
  @Column({ type: 'integer', default: 1 })
  schema_version: number;
 
  @Column({ type: 'varchar', default: 'draft' })
  status: string;                  // draft | active
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
 
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
 
