/**
 * The package is installed by cloudflare/package.json, not at the repository
 * root, so the root type-check cannot resolve it. These are the shapes the
 * Worker uses; keep them in step with cloudflare/src/browser-push.js.
 */
declare module '@block65/webcrypto-web-push' {
  export interface PushKeys {
    p256dh: string;
    auth: string;
  }
  export interface PushMessage {
    data: string;
    options?: { ttl?: number; urgency?: 'very-low' | 'low' | 'normal' | 'high'; topic?: string };
  }
  export interface PushPayload {
    headers: Record<string, string>;
    body: Uint8Array;
  }
  export function buildPushPayload(
    message: PushMessage,
    subscription: Record<string, unknown>,
    keys?: PushKeys,
  ): Promise<PushPayload>;
}
