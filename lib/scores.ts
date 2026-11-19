import { createClient } from "@/lib/supabase/client";

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/YYYY"
}

export type SubmitResult = { ok: true } | { ok: false; message: string };

const DEFAULT_LIMIT = 12;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

export async function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<SubmitResult> {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("scores").insert({
      game_id: input.gameId,
      player_name: input.name.trim().toUpperCase().slice(0, 10),
      score: Math.round(input.score),
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}

export async function fetchLeaderboard(
  gameId: string,
  limit: number = DEFAULT_LIMIT,
): Promise<LeaderboardRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scores_best")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r, i) => ({
    rank: i + 1,
    name: r.player_name as string,
    score: r.score as number,
    date: formatDate(r.created_at as string),
  }));
}
