type RuntimeEnvGlobal = typeof globalThis & {
  __digitalNestRuntimeEnv?: Record<string, string>;
  __digitalNestCloudflareEnv?: Record<string, unknown>;
  process?: { env?: Record<string, string | undefined> };
};

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

  // Stash the raw Cloudflare env so getRuntimeEnv can read it directly, even
  // for keys that are not enumerable at bridge time (Proxies, lazy bindings).
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
        if (!target[key]) target[key] = value;
      } catch {
        // Some runtimes expose a readonly env object; the global fallback above remains available.
      }
    }
  }
}

export function getRuntimeEnv(name: string): string | undefined {
  const g = globalThis as RuntimeEnvGlobal;

  // 1. Bridged process.env (Node dev + populated Cloudflare bridge).
  try {
    if (typeof process !== "undefined") {
      const value = process.env?.[name];
      if (typeof value === "string" && value) return value;
    }
  } catch {
    // Ignore — some runtimes throw on bare `process` access.
  }

  // 2. Bridged runtime env store (populated by bridgeRuntimeEnv).
  const bridged = g.__digitalNestRuntimeEnv?.[name];
  if (typeof bridged === "string" && bridged) return bridged;

  // 3. Raw Cloudflare Worker env object — direct property read handles
  //    Proxy-backed bindings and secrets that aren't enumerable.
  const cf = g.__digitalNestCloudflareEnv;
  if (cf) {
    const value = cf[name];
    if (typeof value === "string" && value) return value;
  }

  return undefined;
}
