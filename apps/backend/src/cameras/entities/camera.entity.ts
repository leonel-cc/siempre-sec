import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('cameras')
export class Camera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  host: string;

  @Column({ default: 554 })
  port: number;

  @Column({ default: '' })
  username: string;

  @Column({ type: 'text', default: '' })
  encrypted_password: string;

  @Column({ name: 'rtsp_url' })
  rtspUrl: string;

  @Column({ name: 'onvif_enabled', default: false })
  onvifEnabled: boolean;

  @Column({ default: true })
  enabled: boolean;

  @Column({ default: 'OFFLINE' })
  status: string;

  @Column({ name: 'connection_type', default: 'RTSP' })
  connectionType: string;

  @Column({ name: 'stream_path', nullable: true })
  streamPath: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
