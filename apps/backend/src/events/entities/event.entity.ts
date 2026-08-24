import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Camera } from '../../cameras/entities/camera.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'camera_id' })
  cameraId: string;

  @ManyToOne(() => Camera)
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  @Column({ name: 'event_type' })
  eventType: string;

  @Column()
  timestamp: string;

  @Column({ type: 'real', default: 0 })
  confidence: number;

  @Column({ name: 'person_id', nullable: true })
  personId: string;

  @Column({ name: 'tracking_id', nullable: true })
  trackingId: number;

  @Column({ name: 'zone_id', nullable: true })
  zoneId: string;

  @Column({ name: 'snapshot_path', nullable: true })
  snapshotPath: string;

  @Column({ name: 'video_path', nullable: true })
  videoPath: string;

  @Column({ default: 'NEW' })
  status: string;

  @Column({ type: 'text', nullable: true })
  metadata: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
