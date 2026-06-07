import { useEffect } from "react";
import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type RealtimeTable =
  | "complaints"
  | "visitors"
  | "notices"
  | "invoices"
  | "amenity_bookings"
  | "residents"
  | "profiles"
  | "guards";

/**
 * Wraps useQuery with a Supabase Realtime subscription so the cache is
 * auto-invalidated whenever the watched table changes (INSERT / UPDATE / DELETE).
 * Falls back to polling every `pollIntervalMs` ms when Realtime is unavailable
 * (e.g. running against a local Supabase with Realtime not fully started).
 */
export function useRealtimeQuery<TData>(
  table: RealtimeTable,
  options: UseQueryOptions<TData> & { pollIntervalMs?: number }
) {
  const { pollIntervalMs = 30_000, ...queryOptions } = options;
  const queryClient = useQueryClient();
  const queryKey = queryOptions.queryKey as readonly unknown[];

  const query = useQuery<TData>({
    ...queryOptions,
    refetchInterval: pollIntervalMs,
  });

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel(`realtime:${table}:${JSON.stringify(queryKey)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, queryClient, JSON.stringify(queryKey)]);

  return query;
}
