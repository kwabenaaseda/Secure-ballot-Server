// src/entities/RolePermission.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique
} from 'typeorm';

@Entity('role_permissions')
@Unique(['role', 'resource', 'action'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  role: string; // matches ROLES union in auth types — kept as string at DB level

  @Column({ type: 'varchar' })
  resource: string; // e.g. "election.tally_live"

  @Column({ type: 'varchar' })
  action: string; // e.g. "read"

  @Column({ type: 'varchar', default: 'ALLOW' })
  effect: "ALLOW" | "DENY";

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}