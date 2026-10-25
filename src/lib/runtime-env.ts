type RuntimeEnvGlobal = typeof globalThis & {
  __digitalNestRuntimeEnv?: Record<string, string>;
  __digitalNestCloudflareEnv?: Record<string, unknown>;
  __env__?: Record<string, unknown>;
  process?: { env?: Record<string, string | undefined> };
};

function readStringBinding(env: unknown, name: string): string | undefined {
  if (!env || typeof env !== "object") return undefined;

  try {
    const value = (env as Record<string, unknown>)[name];
    if (typeof value === "string" && value) return value;
  } catch {
    // Some runtime binding objects can be proxy-backed. Treat unreadable
    // properties as unavailable and continue to the next source.
  }

  return undefined;
}

function stringBindings(env: unknown): Record<string, string> {
  if (!env || typeof env !== "object") return {};
  const out: Record<string, string> = {};
  for (const key of Object.keys(env as Record<string, unknown>)) {
    const value = (env as Record<string, unknown>)[key];
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export async function bridgeRuntimeEnv(env: unknown): Promise<void> {
  const g = globalThis as RuntimeEnvGlobal;

  // Keep the current request's Cloudflare bindings available directly. Runtime
  // bindings must take precedence over build-time/process.env fallbacks.
  if (env && typeof env === "object") {
    g.__digitalNestCloudflareEnv = env as Record<string, unknown>;
  }

  const bindings = stringBindings(env);
  if (Object.keys(bindings).length === 0) return;

  g.__digitalNestRuntimeEnv = { ...(g.__digitalNestRuntimeEnv ?? {}), ...bindings };

  if (!g.process) g.process = { env: {} } as RuntimeEnvGlobal["process"];
  if (!g.process.env) g.process.env = {};

  const targets: Array<Record<string, string | undefined>> = [g.process.env];

  try {
    const nodeProcess = (await import("node:process")) as {
      default?: { env?: Record<string, string | undefined> };
      env?: Record<string, string | undefined>;
    };
    const nodeEnv = nodeProcess.default?.env ?? nodeProcess.env;
    if (nodeEnv && !targets.includes(nodeEnv)) targets.push(nodeEnv);
  } catch {
    // node:process may be unavailable in non-Worker test runtimes.
  }

  for (const [key, value] of Object.entries(bindings)) {
    for (const target of targets) {
      try {
        // Cloudflare's current runtime binding wins over any stale value
        // injected into process.env at build time (e.g. EMAILS_ENABLED=false).
        target[key] = value;
      } catch {
        // Some runtimes expose a readonly env object; the runtime stores above remain available.
      }
    }
  }
}

export function getRuntimeEnv(name: string): string | undefined {
  const g = globalThis as RuntimeEnvGlobal;

  // Prefer the raw Cloudflare Worker bindings captured for this request.
  // Nitro's global __env__ can be a wrapper/build-time view and must not mask
  // the actual Worker binding (for example EMAILS_ENABLED=true in Production).
  const cf = readStringBinding(g.__digitalNestCloudflareEnv, name);
  if (cf) return cf;

  // Next use the values bridged from the actual Cloudflare request bindings.
  const bridged = g.__digitalNestRuntimeEnv?.[name];
  if (typeof bridged === "string" && bridged) return bridged;

  // Nitro fallback for server-function requests when no raw Worker env has
  // been captured yet.
  const nitro = readStringBinding(g.__env__, name);
  if (nitro) return nitro;

  // Process env is only a fallback for local development and non-Cloudflare hosts.
  try {
    if (typeof process !== "undefined") {
      const value = process.env?.[name];
      if (typeof value === "string" && value) return value;
    }
  } catch {
    // Ignore — some runtimes throw on bare process access.
  }

  return undefined;
}
