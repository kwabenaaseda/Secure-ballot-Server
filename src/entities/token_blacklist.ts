import {
  Entity, PrimaryColumn, Column,
  ManyToOne, JoinColumn
} from 'typeorm';
import { User } from './User';
 
@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryColumn({ type: 'varchar' })
  jti: string;                     // JWT ID (unique per token)
 
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;
 
  @Column({ type: 'timestamptz' })
  blacklisted_at: Date;
 
  @Column({ type: 'timestamptz' })
  expires_at: Date;
}
