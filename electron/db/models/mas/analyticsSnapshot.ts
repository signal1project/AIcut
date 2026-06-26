import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { Platform } from '@mas/types';

@Entity({ name: 'mas_analytics_snapshot' })
export class AnalyticsSnapshotModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  accountId!: string;

  @Column({ type: 'varchar' })
  platform!: Platform;

  @Index()
  @Column({ type: 'varchar' })
  externalPostId!: string;

  @Column({ type: 'integer', default: 0 })
  reach!: number;

  @Column({ type: 'integer', default: 0 })
  impressions!: number;

  @Column({ type: 'integer', default: 0 })
  engagements!: number;

  @Column({ type: 'integer', default: 0 })
  clicks!: number;

  @Index()
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  capturedAt!: Date;
}
