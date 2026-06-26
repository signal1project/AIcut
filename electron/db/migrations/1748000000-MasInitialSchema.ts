import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates the MAS US-platform schema. Uses IF NOT EXISTS so it coexists with
// the DataSource's synchronize:true (which may have already created the tables).
export class MasInitialSchema1748000000000 implements MigrationInterface {
  name = 'MasInitialSchema1748000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_connected_account" (
        "id" varchar PRIMARY KEY NOT NULL,
        "platform" varchar NOT NULL,
        "accountName" varchar NOT NULL DEFAULT '',
        "externalId" varchar NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'disconnected',
        "credentialRef" varchar NOT NULL DEFAULT '',
        "tokenExpiresAt" datetime,
        "metadata" text NOT NULL DEFAULT '{}',
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_account_platform" ON "mas_connected_account" ("platform")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_content_asset" (
        "id" varchar PRIMARY KEY NOT NULL,
        "platform" varchar NOT NULL,
        "pubType" varchar NOT NULL DEFAULT 'image-text',
        "body" text NOT NULL DEFAULT '',
        "hashtags" text NOT NULL DEFAULT '[]',
        "mediaRefs" text NOT NULL DEFAULT '[]',
        "status" varchar NOT NULL DEFAULT 'draft',
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_asset_platform" ON "mas_content_asset" ("platform")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_publish_history" (
        "id" varchar PRIMARY KEY NOT NULL,
        "accountId" varchar NOT NULL,
        "platform" varchar NOT NULL,
        "contentAssetId" varchar,
        "status" varchar NOT NULL,
        "externalPostId" varchar NOT NULL DEFAULT '',
        "error" text NOT NULL DEFAULT '',
        "attempts" integer NOT NULL DEFAULT 0,
        "publishedAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_pub_account" ON "mas_publish_history" ("accountId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_scheduled_post" (
        "id" varchar PRIMARY KEY NOT NULL,
        "accountId" varchar NOT NULL,
        "platform" varchar NOT NULL,
        "contentAssetId" varchar NOT NULL,
        "runAt" datetime NOT NULL,
        "status" varchar NOT NULL DEFAULT 'queued',
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_sched_account" ON "mas_scheduled_post" ("accountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_sched_runAt" ON "mas_scheduled_post" ("runAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_engagement_queue" (
        "id" varchar PRIMARY KEY NOT NULL,
        "accountId" varchar NOT NULL,
        "platform" varchar NOT NULL,
        "externalCommentId" varchar NOT NULL,
        "externalPostId" varchar NOT NULL DEFAULT '',
        "authorHandle" varchar NOT NULL DEFAULT '',
        "commentText" text NOT NULL DEFAULT '',
        "draftReply" text NOT NULL DEFAULT '',
        "highConversion" boolean NOT NULL DEFAULT (0),
        "status" varchar NOT NULL DEFAULT 'pending',
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_eng_account" ON "mas_engagement_queue" ("accountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_eng_status" ON "mas_engagement_queue" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_analytics_snapshot" (
        "id" varchar PRIMARY KEY NOT NULL,
        "accountId" varchar NOT NULL,
        "platform" varchar NOT NULL,
        "externalPostId" varchar NOT NULL,
        "reach" integer NOT NULL DEFAULT 0,
        "impressions" integer NOT NULL DEFAULT 0,
        "engagements" integer NOT NULL DEFAULT 0,
        "clicks" integer NOT NULL DEFAULT 0,
        "capturedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_snap_account" ON "mas_analytics_snapshot" ("accountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_snap_post" ON "mas_analytics_snapshot" ("externalPostId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_snap_capturedAt" ON "mas_analytics_snapshot" ("capturedAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mas_audit_log" (
        "id" varchar PRIMARY KEY NOT NULL,
        "action" varchar NOT NULL,
        "entity" varchar NOT NULL,
        "entityId" varchar NOT NULL,
        "details" text NOT NULL DEFAULT '{}',
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_audit_action" ON "mas_audit_log" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_mas_audit_createdAt" ON "mas_audit_log" ("createdAt")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_analytics_snapshot"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_engagement_queue"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_scheduled_post"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_publish_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_content_asset"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "mas_connected_account"`);
  }
}
