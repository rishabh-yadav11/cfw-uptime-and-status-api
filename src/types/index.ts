import type { Context } from 'hono';

export interface Env {
  KV: KVNamespace;
  HMAC_SECRET: string;
}

export interface Variables {
  requestId: string;
  apiKey: ApiKeyData | null;
}

export interface ApiKeyData {
  key_id: string;
  prefix: string;
  plan: 'free' | 'pro' | 'agency';
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  created_at: number;
  last_used_at: number;
}
