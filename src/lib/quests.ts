import { supabase } from "@/integrations/supabase/client";

export type DbQuest = {
  id: string;
  kind: "activity" | "daily";
  title: string;
  description: string;
  icon: string;
  tint: string;
  target: number;
  xp: number;
};

export type UserQuestRow = {
  template_id: string;
  period_key: string;
  progress: number;
  awarded: boolean;
};

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchQuestCatalog(): Promise<DbQuest[]> {
  const { data, error } = await supabase
    .from("quest_templates")
    .select("id,kind,title,description,icon,tint,target,xp")
    .eq("active", true);
  if (error) throw error;
  return (data || []) as DbQuest[];
}

export async function fetchUserQuests(userId: string): Promise<UserQuestRow[]> {
  const { data, error } = await supabase
    .from("user_quests")
    .select("template_id,period_key,progress,awarded")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || []) as UserQuestRow[];
}

export async function fetchTodayReroll(userId: string) {
  const day = todayKey();
  const { data } = await supabase
    .from("user_quest_rerolls")
    .select("used,seed,day")
    .eq("user_id", userId)
    .eq("day", day)
    .maybeSingle();
  return { used: data?.used ?? 0, seed: data?.seed ?? 1 };
}

export async function useDailyReroll() {
  const { data, error } = await supabase.rpc("use_daily_reroll", { _max: 3 });
  if (error) throw error;
  return data as { ok: boolean; remaining: number; seed: number };
}

export async function claimQuestXP(templateId: string, period: string) {
  const { data, error } = await supabase.rpc("claim_quest", {
    _template_id: templateId,
    _period: period,
  });
  if (error) throw error;
  return data as { already: boolean; xp: number; total_xp?: number };
}

export async function syncActivityProgress(
  templateId: string,
  current: number,
  serverProgress: number,
) {
  const delta = Math.max(0, current - serverProgress);
  if (delta === 0) return null;
  const { error } = await supabase.rpc("increment_quest_progress", {
    _template_id: templateId,
    _period: "permanent",
    _delta: delta,
  });
  if (error) throw error;
  return delta;
}

export async function claimLevelReward(level: number, minXP: number, reward: string) {
  const { error } = await supabase.rpc("claim_level_reward", {
    _level: level,
    _min_xp: minXP,
    _reward: reward,
  });
  if (error) throw error;
}

export async function fetchRewardClaims(userId: string): Promise<Set<number>> {
  const { data } = await supabase
    .from("reward_claims")
    .select("level")
    .eq("user_id", userId);
  return new Set((data || []).map((r: any) => r.level as number));
}
