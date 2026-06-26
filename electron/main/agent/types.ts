export type AgentTaskType =
  | 'trend_brief'
  | 'platform_playbook'
  | 'content_concept'
  | 'capcut_package'
  | 'campaign_strategy'
  | 'publishing_plan'
  | 'performance_review';

export type AgentAdapterKind = 'hermes' | 'mock' | 'external';

export interface AgentTaskInput {
  taskType: AgentTaskType;
  objective: string;
  context?: Record<string, unknown>;
  constraints?: string[];
}

export interface AgentArtifact {
  kind: string;
  title: string;
  data: unknown;
}

export interface AgentTaskResult {
  agentId: string;
  kind: AgentAdapterKind;
  status: 'completed' | 'blocked';
  summary: string;
  output: unknown;
  artifacts: AgentArtifact[];
}

export interface AgentAdapter {
  id: string;
  label: string;
  kind: AgentAdapterKind;
  runTask(input: AgentTaskInput): Promise<AgentTaskResult>;
}

export interface HermesAgentAdapterConfig {
  endpoint?: string;
  profile?: string;
  fetcher?: typeof fetch;
}
