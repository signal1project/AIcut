import type { AgentAdapter } from './types';
import { HermesAgentAdapter } from './hermesAgentAdapter';
import { MockAgentAdapter } from './mockAgentAdapter';

export class AgentAdapterRegistry {
  private readonly adapters = new Map<string, AgentAdapter>();

  constructor(private defaultAdapter: AgentAdapter) {
    this.register(defaultAdapter);
  }

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): AgentAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`No agent adapter registered for "${id}".`);
    return adapter;
  }

  getDefault(): AgentAdapter {
    return this.defaultAdapter;
  }

  setDefault(id: string): void {
    this.defaultAdapter = this.get(id);
  }

  list(): AgentAdapter[] {
    return [...this.adapters.values()];
  }
}

export function createDefaultAgentRegistry(): AgentAdapterRegistry {
  const registry = new AgentAdapterRegistry(new HermesAgentAdapter());
  registry.register(new MockAgentAdapter('mock'));
  return registry;
}
