import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PubStatus, type Platform } from '@mas/types';

@Entity({ name: 'mas_scheduled_post' })
export class ScheduledPostModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  accountId!: string;

  @Column({ type: 'varchar' })
  platform!: Platform;

  @Column({ type: 'varchar' })
  contentAssetId!: string;

  @Index()
  @Column({ type: 'datetime' })
  runAt!: Date;

  @Column({ type: 'varchar', default: PubStatus.QUEUED })
  status!: PubStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
