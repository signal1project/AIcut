import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AccountStatus, type Platform } from '@mas/types';

// Token material lives in electron.safeStorage — only credentialRef is persisted here.
@Entity({ name: 'mas_connected_account' })
export class ConnectedAccountModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  platform!: Platform;

  @Column({ type: 'varchar', default: '' })
  accountName!: string;

  @Column({ type: 'varchar', default: '' })
  externalId!: string;

  @Column({ type: 'varchar', default: AccountStatus.DISCONNECTED })
  status!: AccountStatus;

  @Column({ type: 'varchar', default: '' })
  credentialRef!: string;

  @Column({ type: 'datetime', nullable: true })
  tokenExpiresAt!: Date | null;

  @Column({ type: 'simple-json', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
