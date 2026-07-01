import { supabase } from "@/integrations/supabase/client";

export type PostStatus = "pending" | "approved" | "rejected";

export type Post = {
  id: string;
  author_id: string;
  title: string | null;
  content: string;
  media_urls: string[];
  media_types: string[];
  tags: string[];
  location: string | null;
  status: PostStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  // Hydrated:
  author?: { full_name: string | null; email: string | null } | null;
  signed_media?: { url: string; type: string }[];
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
};

const BUCKET = "post-media";

export async function signMedia(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return paths.map(() => "");
  return (data || []).map((d) => d.signedUrl || "");
}

async function hydrate(posts: any[], currentUserId: string | null): Promise<Post[]> {
  if (!posts.length) return [];
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const ids = posts.map((p) => p.id);

  const [{ data: profs }, { data: likes }, { data: comments }, { data: myLikes }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", authorIds),
    supabase.from("post_likes").select("post_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
    currentUserId
      ? supabase.from("post_likes").select("post_id").in("post_id", ids).eq("user_id", currentUserId)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
  const likeCount = new Map<string, number>();
  (likes || []).forEach((l: any) => likeCount.set(l.post_id, (likeCount.get(l.post_id) || 0) + 1));
  const commentCount = new Map<string, number>();
  (comments || []).forEach((c: any) => commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1));
  const likedSet = new Set((myLikes || []).map((l: any) => l.post_id));

  // Sign media per-post (parallel)
  const signed = await Promise.all(
    posts.map(async (p: any) => {
      const urls = await signMedia(p.media_urls || []);
      return urls.map((url, i) => ({ url, type: p.media_types?.[i] || "image" }));
    }),
  );

  return posts.map((p: any, i: number) => ({
    ...p,
    author: profMap.get(p.author_id) || null,
    signed_media: signed[i],
    like_count: likeCount.get(p.id) || 0,
    comment_count: commentCount.get(p.id) || 0,
    liked_by_me: likedSet.has(p.id),
  }));
}

export async function fetchApprovedFeed(currentUserId: string | null, limit = 30): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydrate(data || [], currentUserId);
}

export async function fetchMyPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return hydrate(data || [], userId);
}

export async function fetchPendingPosts(currentUserId: string | null): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return hydrate(data || [], currentUserId);
}

export async function getPost(id: string, currentUserId: string | null): Promise<Post | null> {
  const { data, error } = await supabase.from("posts").select("*").eq("id", id).single();
  if (error || !data) return null;
  const [hydrated] = await hydrate([data], currentUserId);
  return hydrated;
}

export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  } else {
    await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  }
}

export async function listComments(postId: string) {
  const { data: comments } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  const ids = Array.from(new Set((comments || []).map((c: any) => c.user_id)));
  const { data: profs } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as any[] };
  const map = new Map((profs || []).map((p: any) => [p.id, p]));
  return (comments || []).map((c: any) => ({ ...c, author: map.get(c.user_id) || null }));
}

export async function addComment(postId: string, userId: string, content: string) {
  const { error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: userId, content });
  if (error) throw error;
}

export async function uploadMedia(userId: string, file: File): Promise<{ path: string; type: string }> {
  const ext = file.name.split(".").pop() || "bin";
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 60);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  const type = file.type.startsWith("video") ? "video" : "image";
  return { path, type };
}

export async function createPost(input: {
  author_id: string;
  title?: string | null;
  content: string;
  media_urls: string[];
  media_types: string[];
  tags: string[];
  location?: string | null;
}) {
  const { data, error } = await supabase.from("posts").insert({ ...input, status: "pending" }).select().single();
  if (error) throw error;
  return data;
}

export async function updatePost(
  id: string,
  patch: Partial<{
    title: string | null;
    content: string;
    media_urls: string[];
    media_types: string[];
    tags: string[];
    location: string | null;
  }>,
) {
  const { data, error } = await supabase.from("posts").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePost(id: string) {
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
}

export async function moderatePost(postId: string, approve: boolean, reason?: string) {
  const { data, error } = await supabase.rpc("moderate_post", {
    _post_id: postId,
    _approve: approve,
    _reason: reason || undefined,
  });
  if (error) throw error;
  return data;
}
