import type { RawPaycorEmployee } from "./paycorSync";

// Paycor API client. Configuration comes entirely from environment variables so
// no secret is ever committed. Endpoints/paths are overridable because Paycor's
// API surface varies by version/entitlement — defaults target the public API
// (apis.paycor.com). Nothing here runs unless the credentials are set.

export interface PaycorConfig {
  baseUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  subscriptionKey: string;
  tenantId: string;
  scope?: string;
}

export function paycorConfig(): PaycorConfig | null {
  const clientId = process.env.PAYCOR_CLIENT_ID;
  const clientSecret = process.env.PAYCOR_CLIENT_SECRET;
  const subscriptionKey = process.env.PAYCOR_SUBSCRIPTION_KEY;
  const tenantId = process.env.PAYCOR_TENANT_ID;
  if (!clientId || !clientSecret || !subscriptionKey || !tenantId) return null;

  const baseUrl = process.env.PAYCOR_BASE_URL || "https://apis.paycor.com";
  return {
    baseUrl,
    tokenUrl: process.env.PAYCOR_TOKEN_URL || `${baseUrl}/sts/v1/common/token`,
    clientId,
    clientSecret,
    subscriptionKey,
    tenantId,
    scope: process.env.PAYCOR_SCOPE || undefined,
  };
}

export function paycorConfigured(): boolean {
  return paycorConfig() !== null;
}

/** Which required env vars are missing — for a helpful status message. */
export function paycorMissingVars(): string[] {
  return (
    [
      ["PAYCOR_CLIENT_ID", process.env.PAYCOR_CLIENT_ID],
      ["PAYCOR_CLIENT_SECRET", process.env.PAYCOR_CLIENT_SECRET],
      ["PAYCOR_SUBSCRIPTION_KEY", process.env.PAYCOR_SUBSCRIPTION_KEY],
      ["PAYCOR_TENANT_ID", process.env.PAYCOR_TENANT_ID],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);
}

async function getAccessToken(cfg: PaycorConfig): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  if (cfg.scope) body.set("scope", cfg.scope);

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paycor auth failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Paycor auth returned no access_token");
  return json.access_token;
}

async function paycorGet(cfg: PaycorConfig, token: string, path: string): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${cfg.baseUrl}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paycor GET ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Pull the raw records array out of Paycor's paged envelope, tolerant of shape.
function extractRecords(payload: unknown): { records: RawPaycorEmployee[]; nextUrl: string | null } {
  if (Array.isArray(payload)) return { records: payload as RawPaycorEmployee[], nextUrl: null };
  const obj = (payload ?? {}) as Record<string, unknown>;
  const records =
    (obj.records as RawPaycorEmployee[]) ||
    (obj.data as RawPaycorEmployee[]) ||
    (obj.employees as RawPaycorEmployee[]) ||
    (obj.results as RawPaycorEmployee[]) ||
    [];
  // Paging: a continuation token or an explicit next link, if present.
  const nextUrl =
    (obj.nextUri as string) ||
    (obj.next as string) ||
    ((obj.paging as Record<string, unknown> | undefined)?.next as string) ||
    null;
  return { records: Array.isArray(records) ? records : [], nextUrl };
}

/** Fetch every employee for the configured tenant (follows paging up to a cap). */
export async function fetchPaycorEmployees(cfg: PaycorConfig): Promise<RawPaycorEmployee[]> {
  const token = await getAccessToken(cfg);
  const all: RawPaycorEmployee[] = [];
  let path: string | null = `/v1/tenants/${cfg.tenantId}/employees?include=Compensation,Position,Location`;
  let guard = 0;
  while (path && guard < 100) {
    const payload: unknown = await paycorGet(cfg, token, path);
    const { records, nextUrl } = extractRecords(payload);
    all.push(...records);
    path = nextUrl;
    guard++;
  }
  return all;
}
