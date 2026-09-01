import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('cloud_outbox')
@Index(['idempotencyKey'], { unique: true })
@Index(['nextAttemptAt', 'createdAt'])
export class CloudOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key' })
  idempotencyKey: string;

  @Column()
  kind: string;

  @Column({ type: 'text' })
  payload: string;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'datetime' })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
