import type { Platform } from '@mas/types';

export interface CaptionVariant {
  platform: Platform;
  body: string;
  hashtags: string[];
}

export interface CreateCapCutPackageInput {
  campaignId: string;
  campaignTitle: string;
  platforms: Platform[];
  hook: string;
  script: string;
  captionVariants: CaptionVariant[];
  trendKeywords: string[];
  strategyNotes: string[];
}

export interface CapCutScene {
  id: string;
  durationSeconds: number;
  visualDirection: string;
  voiceover: string;
  onScreenText: string;
  brollPrompt: string;
}

export interface CapCutExportTarget {
  platform: Platform;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  caption: string;
  hashtags: string[];
}

export interface CapCutProductionPackage {
  id: string;
  campaignId: string;
  campaignTitle: string;
  status: 'draft';
  editingMode: 'editable_project_package';
  createdAt: string;
  platforms: Platform[];
  trendKeywords: string[];
  strategyNotes: string[];
  scenes: CapCutScene[];
  exports: CapCutExportTarget[];
  rendering: {
    automatedExport: false;
    instructions: string;
  };
  approval: {
    required: true;
    gate: 'omobono_review_then_dale_approval';
  };
  manifestFileName: string;
}

export interface CapCutPackageServiceDeps {
  now?: () => Date;
}
