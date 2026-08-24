import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export type GatewayType = 'manual' | 'stripe' | 'paddle' | 'crypto';
export type GatewayMode = 'live' | 'test';

export interface GatewayRow {
  id: string;
  name: string;
  slug: string;
  type: GatewayType;
  logo_url: string | null;
  description: string | null;
  is_enabled: boolean;
  is_active: boolean;
  mode: GatewayMode;
  sort_order: number;
  config: any;
  created_at?: string;
}

export const listPublicPaymentGateways = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase.rpc("list_public_payment_gateways");
    if (error) throw error;
    return (data || []) as Partial<GatewayRow>[];
  });

export const getAdminPaymentGateways = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from("payment_gateways")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data || []) as GatewayRow[];
  });

export const adminUpsertPaymentGateway = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    id: z.string().optional(),
    name: z.string(),
    slug: z.string(),
    type: z.string(),
    logo_url: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    is_enabled: z.boolean().optional(),
    is_active: z.boolean().optional(),
    mode: z.enum(['live', 'test']).optional(),
    sort_order: z.number().optional(),
    config: z.any().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: gateway, error } = await supabase
      .from("payment_gateways")
      .upsert({
        id: data.id || undefined,
        name: data.name,
        slug: data.slug,
        type: data.type,
        logo_url: data.logo_url,
        description: data.description,
        is_enabled: data.is_enabled ?? true,
        is_active: data.is_active ?? true,
        mode: data.mode || 'live',
        sort_order: data.sort_order || 0,
        config: data.config || {},
      } as any)
      .select()
      .single();

    if (error) throw error;
    return gateway as GatewayRow;
  });
