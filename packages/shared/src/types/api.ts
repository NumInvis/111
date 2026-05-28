export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  traceId?: string;
}

export const GenerationScaleEnum = ['small', 'medium', 'large'] as const;
export type GenerationScale = typeof GenerationScaleEnum[number];

export const GenerationModeEnum = ['quick', 'complete', 'infinite'] as const;
export type GenerationMode = typeof GenerationModeEnum[number];

export interface GenerationPreferences {
  theme: string;
  scale: GenerationScale;
  tone: string;
  seed?: number;
  mode: GenerationMode;
}

export interface LlmProviderInfo {
  active: string;
  available: string[];
}