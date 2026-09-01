import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('system_admins')
export class SystemAdmin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar', unique: true })
  username: string;

  @Column({ type: 'varchar' })
  password_hash: string;

  // super_admin can onboard other admins. admin cannot.
  @Column({ type: 'varchar', default: 'admin' })
  level: 'admin' | 'super_admin';

  @Column({ type: 'varchar', default: 'active' })
  status: 'active' | 'suspended';

  // Who onboarded this admin. Null only for the bootstrap seed super_admin.
  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
