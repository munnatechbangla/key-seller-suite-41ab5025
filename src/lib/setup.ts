import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type SetupStatus = {
  is_completed: boolean;
  completed_at: string | null;
  version: number;
};

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const { data, error } = await supabase
    .from("setup_state")
    .select("is_completed, completed_at, version")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    return { is_completed: false, completed_at: null, version: 1 };
  }
  return (data as any) as SetupStatus;
}

export function useSetupStatus() {
  return useQuery({
    queryKey: ["setup_status"],
    queryFn: fetchSetupStatus,
    staleTime: 30_000,
  });
}

export async function claimFirstAdmin(): Promise<{ ok: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc("claim_first_admin" as any);
  if (error) return { ok: false, reason: error.message };
  return (data as { ok: boolean; reason?: string }) ?? { ok: false, reason: "unknown" };
}

export async function markSetupComplete(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("setup_state")
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function reopenSetup(): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from("setup_state")
    .update({ is_completed: false, completed_at: null })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
