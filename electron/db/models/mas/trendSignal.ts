import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Cached trending signal row.
 * Populated by TrendingResearchService from Google Trends RSS + AI fallback.
 * Rows expire after 1 hour (expiresAt); the service prunes stale rows before
 * returning fresh ones.
 */
@Entity({ name: 'mas_trend_signal' })
export class TrendSignalModel {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Data source: "google" | "twitter" | "ai_generated" | platform name. */
  @Index()
  @Column({ type: 'varchar' })
  source!: string;

  /** Primary keyword / topic headline. */
  @Column({ type: 'varchar' })
  keyword!: string;

  /** JSON array of related hashtags (may be empty). */
  @Column({ type: 'simple-json', default: '[]' })
  hashtags!: string[];

  /**
   * Relative search/volume score from the source (0–100 when available,
   * null when the source doesn't provide volume data).
   */
  @Column({ type: 'integer', nullable: true })
  trafficScore!: number | null;

  /**
   * Niche-relevance score computed by TrendingResearchService (0–100).
   * 0 = no niche match, 100 = exact niche match.
   */
  @Column({ type: 'integer', default: 0 })
  nicheScore!: number;

  /** Free-text niche/category the signal was scored against. */
  @Column({ type: 'varchar', default: '' })
  niche!: string;

  @Index()
  @Column({ type: 'datetime' })
  fetchedAt!: Date;

  /** Rows with expiresAt < NOW are considered stale and re-fetched. */
  @Index()
  @Column({ type: 'datetime' })
  expiresAt!: Date;
}
