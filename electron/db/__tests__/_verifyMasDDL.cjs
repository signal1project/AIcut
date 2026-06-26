// Standalone DDL check — run under Electron's node ABI:
//   ELECTRON_RUN_AS_NODE=1 ./node_modules/.bin/electron electron/db/__tests__/_verifyMasDDL.cjs
// Exercises the mas_ migration SQL against the real better-sqlite3 binary.
const Database = require('better-sqlite3');
const db = new Database(':memory:');

const tables = {
  mas_connected_account: `CREATE TABLE "mas_connected_account" ("id" varchar PRIMARY KEY NOT NULL, "platform" varchar NOT NULL, "accountName" varchar NOT NULL DEFAULT '', "externalId" varchar NOT NULL DEFAULT '', "status" varchar NOT NULL DEFAULT 'disconnected', "credentialRef" varchar NOT NULL DEFAULT '', "tokenExpiresAt" datetime, "metadata" text NOT NULL DEFAULT '{}', "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  mas_content_asset: `CREATE TABLE "mas_content_asset" ("id" varchar PRIMARY KEY NOT NULL, "platform" varchar NOT NULL, "pubType" varchar NOT NULL DEFAULT 'image-text', "body" text NOT NULL DEFAULT '', "hashtags" text NOT NULL DEFAULT '[]', "mediaRefs" text NOT NULL DEFAULT '[]', "status" varchar NOT NULL DEFAULT 'draft', "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  mas_publish_history: `CREATE TABLE "mas_publish_history" ("id" varchar PRIMARY KEY NOT NULL, "accountId" varchar NOT NULL, "platform" varchar NOT NULL, "contentAssetId" varchar, "status" varchar NOT NULL, "externalPostId" varchar NOT NULL DEFAULT '', "error" text NOT NULL DEFAULT '', "attempts" integer NOT NULL DEFAULT 0, "publishedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  mas_scheduled_post: `CREATE TABLE "mas_scheduled_post" ("id" varchar PRIMARY KEY NOT NULL, "accountId" varchar NOT NULL, "platform" varchar NOT NULL, "contentAssetId" varchar NOT NULL, "runAt" datetime NOT NULL, "status" varchar NOT NULL DEFAULT 'queued', "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  mas_engagement_queue: `CREATE TABLE "mas_engagement_queue" ("id" varchar PRIMARY KEY NOT NULL, "accountId" varchar NOT NULL, "platform" varchar NOT NULL, "externalCommentId" varchar NOT NULL, "externalPostId" varchar NOT NULL DEFAULT '', "authorHandle" varchar NOT NULL DEFAULT '', "commentText" text NOT NULL DEFAULT '', "draftReply" text NOT NULL DEFAULT '', "highConversion" boolean NOT NULL DEFAULT (0), "status" varchar NOT NULL DEFAULT 'pending', "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  mas_analytics_snapshot: `CREATE TABLE "mas_analytics_snapshot" ("id" varchar PRIMARY KEY NOT NULL, "accountId" varchar NOT NULL, "platform" varchar NOT NULL, "externalPostId" varchar NOT NULL, "reach" integer NOT NULL DEFAULT 0, "impressions" integer NOT NULL DEFAULT 0, "engagements" integer NOT NULL DEFAULT 0, "clicks" integer NOT NULL DEFAULT 0, "capturedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
  mas_audit_log: `CREATE TABLE "mas_audit_log" ("id" varchar PRIMARY KEY NOT NULL, "action" varchar NOT NULL, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "details" text NOT NULL DEFAULT '{}', "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP))`,
};

for (const [name, ddl] of Object.entries(tables)) {
  db.exec(ddl);
}

// Sanity inserts + reads
db.prepare(`INSERT INTO mas_connected_account (id, platform) VALUES (?, ?)`).run('a1', 'facebook');
const acct = db.prepare(`SELECT status, metadata FROM mas_connected_account WHERE id=?`).get('a1');
if (acct.status !== 'disconnected' || acct.metadata !== '{}') throw new Error('default mismatch: ' + JSON.stringify(acct));

db.prepare(`INSERT INTO mas_engagement_queue (id, accountId, platform, externalCommentId, highConversion) VALUES (?,?,?,?,?)`).run('e1', 'a1', 'twitter', 'c1', 1);
const eng = db.prepare(`SELECT highConversion FROM mas_engagement_queue WHERE id=?`).get('e1');
if (eng.highConversion !== 1) throw new Error('bool mismatch');

const created = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mas_%' ORDER BY name`).all().map((r) => r.name);
console.log('TABLES_OK', created.join(','));
console.log('ROWS_OK', db.prepare('SELECT COUNT(*) c FROM mas_connected_account').get().c, db.prepare('SELECT COUNT(*) c FROM mas_engagement_queue').get().c);
db.close();
console.log('VERIFY_PASS');
