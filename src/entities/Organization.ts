import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, OneToMany
} from 'typeorm';
import { User } from './User';
 
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;
 
  @Column({ type: 'varchar' })
  name: string;
 
  @Column({ type: 'varchar' })
  sector: string;
 
  @Column({ type: 'varchar', nullable: true })
  company_logo: string;
 
  @Column({ type: 'varchar', unique: true })
  email: string;
 
  @Column({ type: 'varchar', default: 'private' })
  visibility: string;               // private | public
 
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'primary_admin_id' })
  primary_admin: User;
 
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
