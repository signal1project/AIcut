import type { DataSource } from 'typeorm';
import type { Platform } from '@mas/types';
import type { CredentialManager } from '../credentials/credentialManager';
import { createOAuthService } from '../oauth';
import { getAdapter } from '../adapters/registry';
import { RateLimitedQueues } from '../scheduling/rateLimitedQueues';
import { Scheduler } from '../scheduling/scheduler';
import { Settings } from '../settings/settings';
import {
  PublishEngine,
  TypeOrmAccountStore,
  TypeOrmAuditStore,
  TypeOrmPublishHistoryStore,
  TypeOrmScheduledPostStore,
  createPublishRouter,
  type EngineAccount,
} from '../publishEngine';
import { AnalyticsService, TypeOrmSnapshotStore, createAnalyticsRouter } from '../analytics';
import { ContentService, createContentRouter } from '../content';
import { EngagementService, TypeOrmEngagementStore, createEngagementRouter } from '../engagement';
import {
  TrendingResearchService,
  GoogleTrendsFetcher,
  PlatformTrendFetcher,
  AITrendFallback,
  createResearchRouter,
} from '../research';
import { PlatformAlgorithmAgent, createAlgorithmRouter } from '../algorithm';
import { createDefaultAgentRegistry, createAgentRouter } from '../agent';
import { CapCutPackageService, createCapCutRouter } from '../capcut';
import { TypeOrmCampaignPackageStore, SocialEngineWorkflowService, createWorkflowRouter } from '../workflow';
import type { FeatureRoute } from '../server';
import { createAIProvider as buildAIProvider } from '../ai';

export interface MasRuntimeDeps {
  dataSource: DataSource;
  settings: Settings;
  credentials: CredentialManager;
}

export interface MasRuntime {
  routes: FeatureRoute[];
  scheduler: Scheduler;
  publish: PublishEngine;
  content: ContentService;
  analytics: AnalyticsService;
  engagement: EngagementService;
  research: TrendingResearchService;
  algorithm: PlatformAlgorithmAgent;
  agentRegistry: ReturnType<typeof createDefaultAgentRegistry>;
  capcut: CapCutPackageService;
  workflow: SocialEngineWorkflowService;
}

/**
 * Composition root: wires the TypeORM stores, OAuth/token resolution, AI
 * provider selection, rate-limit queue, and scheduler into the four feature
 * services and their API routers. Everything platform-facing flows through here.
 */
export function buildMasRuntime(deps: MasRuntimeDeps): MasRuntime {
  const { dataSource, settings, credentials } = deps;

  const oauth = createOAuthService(credentials);
  const queue = new RateLimitedQueues();
  const scheduler = new Scheduler();

  const resolveToken = async (account: EngineAccount): Promise<string> => {
    const config = settings.getPlatformOAuth(account.platform);
    if (!config) {
      throw new Error(`No OAuth client configured for ${account.platform}. Set it in Settings.`);
    }
    const bundle = await oauth.ensureFresh(account.platform, account.credentialRef, config);
    return bundle.accessToken;
  };

  const resolveAdapter = (platform: Platform) => getAdapter(platform);

  const resolveProvider = () => {
    const active = settings.getActiveAIProvider();
    if (!active) throw new Error('No AI provider configured. Set one in Settings.');
    return buildAIProvider(active.name, {
      apiKey: active.apiKey,
      baseUrl: active.baseUrl,
      model: active.model,
    });
  };
  const resolveImageProvider = () => {
    const img = settings.getImageProvider();
    if (!img) throw new Error('OpenAI API key required for image generation.');
    return buildAIProvider('openai', { apiKey: img.apiKey });
  };

  const accounts = new TypeOrmAccountStore(dataSource);
  const audit = new TypeOrmAuditStore(dataSource);

  const publish = new PublishEngine({
    accounts,
    history: new TypeOrmPublishHistoryStore(dataSource),
    scheduled: new TypeOrmScheduledPostStore(dataSource),
    audit,
    resolveToken,
    resolveAdapter,
    queue,
  });

  // Algorithm agent is created first (no deps) so ContentService can reference it.
  const algorithm = new PlatformAlgorithmAgent();

  const content = new ContentService({ resolveProvider, resolveImageProvider, algorithmAgent: algorithm });

  const analytics = new AnalyticsService({
    accounts,
    snapshots: new TypeOrmSnapshotStore(dataSource),
    resolveToken,
    resolveAdapter,
    queue,
  });

  const engagement = new EngagementService({
    accounts,
    store: new TypeOrmEngagementStore(dataSource),
    audit,
    resolveToken,
    resolveAdapter,
    resolveProvider,
    queue,
  });

  // Research: Google Trends RSS + AI fallback (niche is set per-request).
  // The AI fallback uses a closure that re-resolves the provider each call so
  // it stays in sync with the user's active provider setting.
  const resolveTrendProvider = () => {
    try {
      return resolveProvider();
    } catch {
      return null;
    }
  };

  const trendFetchers = [
    new GoogleTrendsFetcher(),
    new PlatformTrendFetcher('tiktok'),
    new PlatformTrendFetcher('instagram'),
    new PlatformTrendFetcher('youtube'),
    new PlatformTrendFetcher('x'),
    new PlatformTrendFetcher('rumble'),
    // AI fallback is instantiated lazily per-request via a wrapper fetcher so
    // we always use the currently-configured AI provider.
    {
      sourceName: 'ai_generated',
      fetch: async () => {
        const p = resolveTrendProvider();
        if (!p) return [];
        const fallback = new AITrendFallback(p, '');
        return fallback.fetch();
      },
    },
  ];

  const research = new TrendingResearchService(dataSource, trendFetchers);
  const agentRegistry = createDefaultAgentRegistry();
  const capcut = new CapCutPackageService();
  const packageStore = new TypeOrmCampaignPackageStore(dataSource);
  const workflow = new SocialEngineWorkflowService({
    research,
    algorithm,
    content,
    capcut,
    agent: agentRegistry.getDefault(),
    packageStore,
  });

  const routes: FeatureRoute[] = [
    { path: '/publish', router: createPublishRouter(publish, scheduler) },
    { path: '/content', router: createContentRouter(content) },
    { path: '/analytics', router: createAnalyticsRouter(analytics) },
    { path: '/engagement', router: createEngagementRouter(engagement) },
    { path: '/research', router: createResearchRouter(research) },
    { path: '/algorithm', router: createAlgorithmRouter(algorithm) },
    { path: '/agent', router: createAgentRouter(agentRegistry) },
    { path: '/capcut', router: createCapCutRouter(capcut) },
    { path: '/workflow', router: createWorkflowRouter(workflow) },
  ];

  return { routes, scheduler, publish, content, analytics, engagement, research, algorithm, agentRegistry, capcut, workflow };
}
