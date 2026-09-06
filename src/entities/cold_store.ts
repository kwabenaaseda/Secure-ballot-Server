import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Election } from './Election';

// ─── TIER 3 — DESIGNED, NOT YET IMPLEMENTED ──────────────────────────────────
// Intended as the permanent archive written when results are RELEASED
// (winner_per_category + full_results + is_final). No service writes to it
// today; release_results only stamps the election row. Natural wiring point:
// ReleaseResults_Operation, immediately after commit.
@Entity('cold_store')
export class ColdStore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Election, { nullable: false })
  @JoinColumn({ name: 'election_id' })
  election: Election;

  @Column({ type: 'varchar' })
  election_name: string;

  @Column({ type: 'varchar', nullable: true })
  field: string;

  @Column({ type: 'varchar', nullable: true })
  icon: string;

  @Column({ type: 'integer' })
  total_votes: number;

  @Column({ type: 'jsonb', nullable: true })
  winner_per_category: Record<string, any>;

  @Column({ type: 'jsonb' })
  full_results: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  computed_at: Date;

  @Column({ type: 'boolean', default: false })
  is_final: boolean;
}
