import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  sector: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  company_logo: string;

  @Column({ type: 'varchar', nullable: true })
  website: string | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: "smallint", nullable: true })
  established_year: number | null;

  @Column({ type: 'varchar', default: 'private' })
  visibility: string; // private | public

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'primary_admin_id' })
  primary_admin: User;

  // ── ADMIN APPROVAL WORKFLOW ─────────────────────────────────────────────
  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'active' | 'suspended' | 'rejected';

  // Free-form for now: URLs/references to uploaded verification docs.
  // Nullable — approval doesn't hard-require documents today, but the
  // column exists so we're not blocked when document upload lands.
  @Column({ type: 'jsonb', nullable: true })
  verification_documents: string[] | null;

  // System admin id who approved/rejected/suspended. Plain uuid, not a
  // relation — SystemAdmin is a deliberately isolated table (see the
  // entity's own comment), so Organization shouldn't FK into it directly.
  @Column({ type: 'uuid', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
