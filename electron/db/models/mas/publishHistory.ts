import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PubStatus, type Platform } from '@mas/types';

@Entity({ name: 'mas_publish_history' })
export class PublishHistoryModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  accountId!: string;

  @Column({ type: 'varchar' })
  platform!: Platform;

  @Column({ type: 'varchar', nullable: true })
  contentAssetId!: string | null;

  @Column({ type: 'varchar' })
  status!: PubStatus;

  @Column({ type: 'varchar', default: '' })
  externalPostId!: string;

  @Column({ type: 'text', default: '' })
  error!: string;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
