import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { EngagementStatus, type Platform } from '@mas/types';

@Entity({ name: 'mas_engagement_queue' })
export class EngagementQueueItemModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  accountId!: string;

  @Column({ type: 'varchar' })
  platform!: Platform;

  @Column({ type: 'varchar' })
  externalCommentId!: string;

  @Column({ type: 'varchar', default: '' })
  externalPostId!: string;

  @Column({ type: 'varchar', default: '' })
  authorHandle!: string;

  @Column({ type: 'text', default: '' })
  commentText!: string;

  // LLM-drafted reply awaiting human approval.
  @Column({ type: 'text', default: '' })
  draftReply!: string;

  @Column({ type: 'boolean', default: false })
  highConversion!: boolean;

  @Index()
  @Column({ type: 'varchar', default: EngagementStatus.PENDING })
  status!: EngagementStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
