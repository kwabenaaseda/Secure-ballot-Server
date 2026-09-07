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
 * One row per enrolled device per user — the server-side half of the WebAuthn
 * enrollment that the client-side useBiometricEnrollment hook simulates today.
 *
 * What we store: the credential ID, the COSE public key, a sign counter
 * (replay detection), and a human-readable device label. What we NEVER store:
 * any raw biometric. The private key never leaves the user's secure enclave.
 */
@Entity('biometric_credentials')
@Index(['user_id'])
@Index(['credential_id'], { unique: true })
export class BiometricCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // WebAuthn credential ID (base64url). Unique per credential globally.
  @Column({ type: 'varchar', name: 'credential_id', unique: true })
  credential_id: string;

  // COSE-format public key, stored as base64url for verification.
  @Column({ type: 'text', name: 'public_key' })
  public_key: string;

  // Last seen signature counter — increments per authentication, blocks replay.
  @Column({ type: 'integer', name: 'sign_count', default: 0 })
  sign_count: number;

  // Human-readable label the user gave this device ("iPhone 15", "MacBook Pro").
  @Column({ type: 'varchar', name: 'device_name', nullable: true })
  device_name: string | null;

  // WebAuthn transports (usb, nfc, ble, internal) reported at registration.
  @Column({ type: 'varchar', array: true, name: 'transports', default: '{}' })
  transports: string[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  created_at: Date;
}
