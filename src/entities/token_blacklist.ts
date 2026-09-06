import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryColumn({ type: 'varchar' })
  jti: string; // JWT ID (unique per token)

  // Nullable: SYSTEM_ADMIN tokens have no users-table row to reference.
  // (Altered via migration MakeTokenBlacklistUserOptional.)
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'timestamptz' })
  blacklisted_at: Date;

  @Column({ type: 'timestamptz' })
  expires_at: Date;
}
