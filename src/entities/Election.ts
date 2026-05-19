import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';
import { Organization } from './Organization';
 
@Entity('elections')
export class Election {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  org: Organization;
 
  @Column({ type: 'varchar' })
  name: string;
 
  @Column({ type: 'text', nullable: true })
  summary: string;
 
  @Column({ type: 'varchar', nullable: true })
  field: string;
 
  @Column({ type: 'varchar', nullable: true })
  location: string;
 
  @Column({ type: 'varchar', default: 'private' })
  visibility: string;              // private | public
 
  @Column({ type: 'boolean', default: false })
  is_public: boolean;              // If true, anyone can vote (no membership required)
 
  @Column({ type: 'varchar', nullable: true })
  scope: string;
 
  @Column({ type: 'varchar', nullable: true })
  icon: string;
 
  @Column({ type: 'varchar', default: 'draft' })
  status: string;                  // draft | published | closed | archived
 
  @Column({ type: 'jsonb', default: '[]' })
  categories: any[];               // Election categories (e.g. ['President', 'VP'])
 
  @Column({ type: 'timestamptz' })
  start_at: Date;
 
  @Column({ type: 'timestamptz' })
  end_at: Date;
 
  @Column({ type: 'timestamptz', nullable: true })
  registration_cutoff_at: Date;
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
