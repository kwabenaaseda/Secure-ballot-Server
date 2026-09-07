import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './User';

/**
 * One in-app notification per event. Created best-effort by the service that
 * performed the triggering action (join decision, election lifecycle, …).
 * Delivery to the client is pull-based (the bell icon polls /notifications);
 * email/SMS dispatch for these events is NOT wired yet — these rows are the
 * in-app channel only.
 */
@Entity('notifications')
@Index(['user_id'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Machine-readable event type so the client can pick an icon/link route.
  // e.g. 'JOIN_APPROVED' | 'JOIN_DENIED' | 'ELECTION_PUBLISHED' | 'RESULTS_RELEASED'
  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  // Where the client should navigate when the notification is clicked.
  @Column({ type: 'varchar', nullable: true })
  link: string | null;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  is_read: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
