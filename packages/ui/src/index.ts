// @mas/ui — shared React components, the embedded-API client, and helpers.
// Uses Ant Design (inherited from upstream). Consumed by the renderer (src/)
// and the downstream Hermes_Social / BLKINK_Social apps.

export const MAS_UI_VERSION = '1.0.0';

export {
  MasApiClient,
  MasApiError,
  type MasApiClientOptions,
  type PublishRequestBody,
  type PublishOutcome,
  type AccountPublishResult,
  type ScheduleAccepted,
  type GeneratedContent,
  type GenerateResult,
  type AnalyticsSnapshot,
  type EngagementItem,
  type TrendSignal,
  type TrendingResponse,
  type AlgorithmHints,
  type AgentAdaptersResponse,
  type AgentAdapterInfo,
  type WorkflowCampaignPackageRequest,
  type WorkflowCampaignPackageResult,
  type CampaignPackageSummary,
  type AIProviderStatus,
  type SettingsStatus,
  type ContentIdea,
  type ScrapeResponse,
  type ConnectedAccountSummary,
  type PropertyListingSummary,
  type ListListingsResponse,
  type ComplianceFlagInfo,
  type ListingAdResult,
  type ListingAdItem,
} from './apiClient';

export { PlatformBadge, type PlatformBadgeProps } from './components/PlatformBadge';
export { StatusTag, type StatusTagProps } from './components/StatusTag';
export { MetricCard, type MetricCardProps } from './components/MetricCard';
