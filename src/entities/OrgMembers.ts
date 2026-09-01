import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

@Entity('org_members')
@Unique(['org', 'user']) // One user per org
export class OrgMembers {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { nullable: false })
  @JoinColumn({ name: 'org_id' })
  org: Organization;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', default: 'voter' })
  role: 'voter' | 'moderator' | 'admin'; // voter | moderator | admin

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'active' | 'deactivated'; // pending | active | inactive

  @Column({ type: 'varchar', nullable: true })
  verified_via: 'email_verified' | 'phone_verified' | 'custom'; // How they were verified (email, phone, custom)

  @Column({ type: 'timestamptz', nullable: true })
  joined_at: Date | null;
}
