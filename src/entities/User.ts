import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, OneToMany
} from 'typeorm';
 
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ type: 'varchar', unique: true })
  email: string;
 
  @Column({ type: 'varchar', nullable: true })
  telephone: string;
 
  @Column({ type: 'varchar', unique: true })
  username: string;
 
  @Column({ type: 'varchar' })
  password_hash: string;
 
  @Column({ type: 'varchar', nullable: true })
  biometric_hash: string;           // SHA-256 only. Raw biometric NEVER stored.
 
  @Column({ type: 'date' })
  date_of_birth: Date;
 
  @Column({ type: 'varchar', nullable: true })
  nationality: string;
 
  @Column({ type: 'varchar', nullable: true })
  occupation: string;
 
  @Column({ type: 'jsonb', nullable: true })
  fields_of_interest: Record<string, any>;
 
  @Column({ type: 'varchar', nullable: true })
  profile_picture: string;
 
  @Column({ type: 'varchar', default: 'unverified' })
  verification_status: string;      // unverified | phone_verified | verified
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
