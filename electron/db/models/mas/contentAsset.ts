import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { PubType, PubStatus, type Platform } from '@mas/types';

@Entity({ name: 'mas_content_asset' })
export class ContentAssetModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  platform!: Platform;

  @Column({ type: 'varchar', default: PubType.IMAGE_TEXT })
  pubType!: PubType;

  @Column({ type: 'text', default: '' })
  body!: string;

  @Column({ type: 'simple-json', default: '[]' })
  hashtags!: string[];

  @Column({ type: 'simple-json', default: '[]' })
  mediaRefs!: string[];

  @Column({ type: 'varchar', default: PubStatus.DRAFT })
  status!: PubStatus;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
