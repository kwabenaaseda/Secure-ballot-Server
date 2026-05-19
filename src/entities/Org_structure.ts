import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
 
@Entity('org_structure')
export class OrgStructure {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  org: Organization;
 
  @Column({ type: 'varchar' })
  category: string;                 // e.g. 'department', 'level', 'role'
 
  @Column({ type: 'jsonb' })
  values: Record<string, any>;      // e.g. ['Engineering', 'Marketing', 'HR']
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
 
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
