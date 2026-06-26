import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { AuditAction } from '@mas/types';

@Entity({ name: 'mas_audit_log' })
export class AuditLogModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar' })
  action!: AuditAction;

  @Column({ type: 'varchar' })
  entity!: string;

  @Column({ type: 'varchar' })
  entityId!: string;

  @Column({ type: 'simple-json', default: '{}' })
  details!: Record<string, unknown>;

  @Index()
  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
