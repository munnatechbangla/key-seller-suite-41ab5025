// Public reviews read layer (RLS allows anon to read approved reviews).
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  admin_reply: string | null;
  admin_reply_at: string | null;
  created_at: string;
};

export type ReviewBreakdown = {
  average: number;
  total: number;
  counts: Record<1 | 2 | 3 | 4 | 5, number>;
};

export async function fetchApprovedReviews(productId: string, limit = 50): Promise<PublicReview[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("id, rating, title, body, display_name, is_verified, admin_reply, admin_reply_at, created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as any[];
}

export function computeBreakdown(reviews: PublicReview[]): ReviewBreakdown {
  const counts: ReviewBreakdown["counts"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  reviews.forEach((r) => {
    const k = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    counts[k] += 1;
    sum += r.rating;
  });
  const total = reviews.length;
  return { average: total ? +(sum / total).toFixed(2) : 0, total, counts };
}

export const reviewsQuery = (productId: string | undefined) =>
  queryOptions({
    queryKey: ["reviews", productId ?? "none"],
    queryFn: () => (productId ? fetchApprovedReviews(productId) : Promise.resolve([] as PublicReview[])),
    enabled: !!productId,
  });

export const useApprovedReviews = (productId: string | undefined) =>
  useQuery(reviewsQuery(productId)).data ?? [];
