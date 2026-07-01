import { supabase } from "@/integrations/supabase/client";

export type DifficultyTier = "easy" | "medium" | "hard";
export type ProjectStatus = "active" | "submitted" | "approved" | "rejected" | "cancelled";

export const TIER_LABEL: Record<DifficultyTier, string> = {
  easy: "Հեշտ",
  medium: "Միջին",
  hard: "Բարդ",
};

export const TIER_COST: Record<DifficultyTier, number> = { easy: 200, medium: 400, hard: 700 };
export const TIER_REWARD: Record<DifficultyTier, { standard: number; exceptional: number }> = {
  easy: { standard: 400, exceptional: 500 },
  medium: { standard: 800, exceptional: 1000 },
  hard: { standard: 1500, exceptional: 2000 },
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Ակտիվ",
  submitted: "Սպասում է ստուգման",
  approved: "Հաստատված",
  rejected: "Մերժված",
  cancelled: "Չեղարկված",
};

export function normalizeTier(diff?: string | null): DifficultyTier {
  const d = (diff || "").toLowerCase();
  if (d.includes("բարդ") || d.includes("hard") || d.includes("ադվ") || d.includes("adv")) return "hard";
  if (d.includes("միջ") || d.includes("medium") || d.includes("inter")) return "medium";
  return "easy";
}

const BUCKET = "project-media";

export async function startProjectRpc(input: {
  title: string;
  shortDescription: string;
  fullDescription?: string;
  matchingInterests?: string[];
  teamSize?: string;
  firstSteps?: any;
  difficultyTier: DifficultyTier;
}) {
  const { data, error } = await supabase.rpc("start_project", {
    _title: input.title,
    _short_description: input.shortDescription || "",
    _full_description: input.fullDescription || input.shortDescription || "",
    _matching_interests: input.matchingInterests || [],
    _team_size: input.teamSize || "",
    _first_steps: input.firstSteps || [],
    _difficulty_tier: input.difficultyTier,
  });
  if (error) throw error;
  return data as any;
}

export async function submitProject(projectId: string) {
  const { data, error } = await supabase.rpc("submit_project", { _project_id: projectId });
  if (error) throw error;
  return data as any;
}

export async function cancelProject(projectId: string) {
  const { data, error } = await supabase.rpc("cancel_project", { _project_id: projectId });
  if (error) throw error;
  return data as any;
}

export async function reviewProject(projectId: string, opts: { approve: boolean; exceptional?: boolean; rating?: number | null; reason?: string | null }) {
  const { data, error } = await supabase.rpc("review_project", {
    _project_id: projectId,
    _approve: opts.approve,
    _exceptional: !!opts.exceptional,
    _rating: opts.rating ?? undefined,
    _reason: opts.reason ?? undefined,
  });
  if (error) throw error;
  return data as any;
}

export async function countActiveProjects(userId: string) {
  const { data, error } = await supabase.rpc("count_active_projects", { _uid: userId });
  if (error) throw error;
  return (data as number) || 0;
}

export async function fetchUserRank(userId: string) {
  const { data, error } = await supabase.rpc("get_user_rank", { _uid: userId });
  if (error) throw error;
  return data as {
    score: number; tier: string; completed: number; exceptional: number;
    avg_rating: number; activity: number; reliability: number; badges: number;
  };
}

export async function fetchParticipants(projectId: string) {
  const { data, error } = await supabase
    .from("project_participants")
    .select("user_id, role, joined_at")
    .eq("project_id", projectId);
  if (error) throw error;
  const ids = (data || []).map((p) => p.user_id);
  if (!ids.length) return [];
  const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  const m = new Map((profs || []).map((p: any) => [p.id, p]));
  return (data || []).map((p: any) => ({ ...p, profile: m.get(p.user_id) || null }));
}

// --- chat ---
export type ProjectMessage = {
  id: string; project_id: string; user_id: string; content: string;
  media_urls: string[]; media_types: string[]; created_at: string;
  author?: { full_name: string | null; email: string | null } | null;
  signed_media?: { url: string; type: string }[];
};

export async function uploadProjectMedia(projectId: string, file: File) {
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 60);
  const path = `${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return { path, type: file.type.startsWith("video") ? "video" : file.type.startsWith("image") ? "image" : "file" };
}

async function signProjectMedia(paths: string[]) {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  return (data || []).map((d) => d.signedUrl || "");
}

export async function fetchProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const { data, error } = await supabase
    .from("project_messages").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data || []) as ProjectMessage[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id)));
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as any[] };
  const map = new Map((profs || []).map((p: any) => [p.id, p]));
  const signed = await Promise.all(rows.map(async (r) => {
    const urls = await signProjectMedia(r.media_urls || []);
    return urls.map((u, i) => ({ url: u, type: r.media_types?.[i] || "file" }));
  }));
  return rows.map((r, i) => ({ ...r, author: map.get(r.user_id) || null, signed_media: signed[i] }));
}

export async function sendProjectMessage(input: {
  projectId: string; userId: string; content: string;
  media: { path: string; type: string }[];
}) {
  const { error } = await supabase.from("project_messages").insert({
    project_id: input.projectId,
    user_id: input.userId,
    content: input.content,
    media_urls: input.media.map((m) => m.path),
    media_types: input.media.map((m) => m.type),
  });
  if (error) throw error;
}
