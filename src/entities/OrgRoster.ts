import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from './Organization';

// One row per member on an org's uploaded roster (authoritative membership
// list imported from the org's existing records — CSV export, database dump).
// A join request whose account email matches an 'unclaimed' entry here is
// auto-activated instead of waiting for manual admin review.
@Entity('org_roster_entries')
@Index(['org', 'email'], { unique: false })
export class OrgRoster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org: Organization;

  // Lowercased account email this roster row is expected to join with.
  // Null when the import had no email column (match then happens on
  // custom_data fields during admin review instead).
  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  // The rest of the row mapped onto the org's custom_fields keys
  // (membership number, department, etc.) — same shape as
  // OrgMemberProfiles.custom_data so review screens can treat both alike.
  @Column({ type: 'jsonb', default: '{}' })
  custom_data: Record<string, any>;

  // unclaimed: nobody has joined with this row yet.
  // claimed:   a user joined and was matched to this row.
  @Column({ type: 'varchar', default: 'unclaimed' })
  status: 'unclaimed' | 'claimed';

  @Column({ type: 'uuid', nullable: true })
  matched_user_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  claimed_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
