import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Person } from './person.entity';

@Entity('face_embeddings')
export class FaceEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'person_id' })
  personId: string;

  @ManyToOne(() => Person, (p) => p.embeddings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @Column({ type: 'text' })
  embedding: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
