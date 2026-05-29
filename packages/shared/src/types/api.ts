export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  traceId?: string;
}

export interface LlmProviderInfo {
  active: string;
  available: string[];
}
