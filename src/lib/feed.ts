import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PostStatus = "pending" | "approved" | "rejected";

type MemberDirectoryEntry = { id: string; full_name: string | null; xp: number };

export type Post = Tables<"posts"> & {
  // Hydrated:
  author?: Omit<MemberDirectoryEntry, "id"> | null;
  signed_media?: { url: string; type: string }[];
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
};

const BUCKET = "post-media";
export const MAX_POST_MEDIA_FILES = 8;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const POST_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export async function removeMediaFiles(paths: string[]) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
}

export async function signMedia(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return paths.map(() => "");
  return (data || []).map((d) => d.signedUrl || "");
}

async function hydrate(posts: Tables<"posts">[], currentUserId: string | null): Promise<Post[]> {
  if (!posts.length) return [];
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const ids = posts.map((p) => p.id);

  const [{ data: profs }, { data: likes }, { data: comments }, { data: myLikes }] =
    await Promise.all([
      supabase.rpc("get_member_directory", { _user_ids: authorIds }),
      supabase.from("post_likes").select("post_id").in("post_id", ids),
      supabase.from("post_comments").select("post_id").in("post_id", ids),
      currentUserId
        ? supabase
            .from("post_likes")
            .select("post_id")
            .in("post_id", ids)
            .eq("user_id", currentUserId)
        : Promise.resolve({ data: [] as Pick<Tables<"post_likes">, "post_id">[] }),
    ]);

  const profMap = new Map((profs || []).map((profile) => [profile.id, profile]));
  const likeCount = new Map<string, number>();
  (likes || []).forEach((like) =>
    likeCount.set(like.post_id, (likeCount.get(like.post_id) || 0) + 1),
  );
  const commentCount = new Map<string, number>();
  (comments || []).forEach((comment) =>
    commentCount.set(comment.post_id, (commentCount.get(comment.post_id) || 0) + 1),
  );
  const likedSet = new Set((myLikes || []).map((like) => like.post_id));

  // Sign media per-post (parallel)
  const signed = await Promise.all(
    posts.map(async (post) => {
      const urls = await signMedia(post.media_urls || []);
      return urls.map((url, index) => ({
        url,
        type: post.media_types?.[index] || "image",
      }));
    }),
  );

  return posts.map((post, index) => ({
    ...post,
    author: profMap.get(post.author_id) || null,
    signed_media: signed[index],
    like_count: likeCount.get(post.id) || 0,
    comment_count: commentCount.get(post.id) || 0,
    liked_by_me: likedSet.has(post.id),
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

/** The signed-in user's own not-yet-approved posts, to pin above the feed. */
export async function fetchMyPending(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", userId)
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  return hydrate(data || [], userId);
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
  const ids = Array.from(new Set((comments || []).map((comment) => comment.user_id)));
  const { data: profs } = ids.length
    ? await supabase.rpc("get_member_directory", { _user_ids: ids })
    : { data: [] as MemberDirectoryEntry[] };
  const map = new Map((profs || []).map((profile) => [profile.id, profile]));
  return (comments || []).map((comment) => ({
    ...comment,
    author: map.get(comment.user_id) || null,
  }));
}

export async function addComment(postId: string, userId: string, content: string) {
  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: userId, content });
  if (error) throw error;
}

export async function uploadMedia(
  userId: string,
  file: File,
): Promise<{ path: string; type: string }> {
  if (!POST_MEDIA_TYPES.has(file.type) || file.size > MAX_MEDIA_BYTES) {
    throw new Error("Ընտրիր JPG, PNG, WebP, GIF, MP4, WebM կամ MOV ֆայլ՝ մինչև 25 ՄԲ։");
  }
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 60);
  const path = `${userId}/${crypto.randomUUID()}-${safe}`;
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
  const { data, error } = await supabase.from("posts").insert(input).select().single();
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
  const { data: existing } = await supabase
    .from("posts")
    .select("media_urls")
    .eq("id", id)
    .maybeSingle();
  const { data, error } = await supabase.from("posts").update(patch).eq("id", id).select().single();
  if (error) throw error;
  if (patch.media_urls && existing?.media_urls) {
    const removed = existing.media_urls.filter((path) => !patch.media_urls?.includes(path));
    try {
      await removeMediaFiles(removed);
    } catch (cleanupError: unknown) {
      console.error("Could not remove detached post media", cleanupError);
    }
  }
  return data;
}

export async function deletePost(id: string) {
  const { data: existing } = await supabase
    .from("posts")
    .select("media_urls")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw error;
  try {
    await removeMediaFiles(existing?.media_urls || []);
  } catch (cleanupError: unknown) {
    console.error("Could not remove deleted post media", cleanupError);
  }
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
