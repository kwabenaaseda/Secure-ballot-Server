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
 
  @Column({ type: 'varchar', unique:true })
  telephone: string;
 
  @Column({ type: 'varchar', unique: true })
  username: string;
 
  @Column({ type: 'varchar' })
  password_hash: string;
 
  @Column({ type: 'varchar', nullable: true })
  biometric_hash: string;           // SHA-256 only. Raw biometric NEVER stored.
 
  @Column({ type: 'date' , nullable:true})
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
  verification_status: "unverified" | "phone_verified" | "email_verified" | "verified";      // unverified | phone_verified | email_verified | verified
 
  @Column({type: 'varchar', default: 'green'})
  user_status: "green" | "yellow" | "red"

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
