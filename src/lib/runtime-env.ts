type RuntimeEnvGlobal = typeof globalThis & {
  __digitalNestRuntimeEnv?: Record<string, string>;
  process?: { env?: Record<string, string | undefined> };
};

function stringBindings(env: unknown): Record<string, string> {
  if (!env || typeof env !== "object") return {};
  return Object.fromEntries(
    Object.entries(env as Record<string, unknown>).filter((entry): entry is [string, string] => {
      const [, value] = entry;
      return typeof value === "string";
    }),
  );
}

export async function bridgeRuntimeEnv(env: unknown): Promise<void> {
  const bindings = stringBindings(env);
  if (Object.keys(bindings).length === 0) return;

  const g = globalThis as RuntimeEnvGlobal;
  g.__digitalNestRuntimeEnv = { ...(g.__digitalNestRuntimeEnv ?? {}), ...bindings };

  if (!g.process) g.process = { env: {} };
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
  try {
    const value = process.env?.[name];
    if (value) return value;
  } catch {
    // Ignore and use the bridged Worker binding store.
  }

  return (globalThis as RuntimeEnvGlobal).__digitalNestRuntimeEnv?.[name];
}