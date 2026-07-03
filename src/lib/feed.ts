import { supabase } from "@/integrations/supabase/client";

export type PostStatus = "pending" | "approved" | "rejected";
export type FeedVisibility = "public" | "students" | "connections";
export type FeedProfile = {
  user_id: string;
  headline: string | null;
  about: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  feed_topics: string[];
  looking_for: string[];
  setup_completed: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Author = {
  full_name: string | null;
  email: string | null;
  school?: string | null;
  feed_profile?: FeedProfile | null;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: Author | null;
};

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
  visibility?: FeedVisibility;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  author?: Author | null;
  signed_media?: { url: string; type: string }[];
  like_count?: number;
  comment_count?: number;
  repost_count?: number;
  save_count?: number;
  liked_by_me?: boolean;
  saved_by_me?: boolean;
  following_author?: boolean;
  score?: number;
};

const BUCKET = "post-media";

const emptyFeedProfile = (userId: string): FeedProfile => ({
  user_id: userId,
  headline: null,
  about: null,
  avatar_url: null,
  banner_url: null,
  website_url: null,
  feed_topics: [],
  looking_for: [],
  setup_completed: false,
});

export async function signMedia(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
  if (error) return paths.map(() => "");
  return (data || []).map((d) => d.signedUrl || "");
}

export async function getFeedProfile(userId: string): Promise<FeedProfile> {
  const { data, error } = await supabase
    .from("feed_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return emptyFeedProfile(userId);
  return data as FeedProfile;
}

export async function upsertFeedProfile(profile: FeedProfile): Promise<FeedProfile> {
  const { data, error } = await supabase
    .from("feed_profiles")
    .upsert({ ...profile, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data as FeedProfile;
}

async function hydrate(posts: Post[], currentUserId: string | null): Promise<Post[]> {
  if (!posts.length) return [];
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));
  const ids = posts.map((p) => p.id);

  const [
    profilesRes,
    feedProfilesRes,
    likesRes,
    commentsRes,
    savesRes,
    repostsRes,
    myLikesRes,
    mySavesRes,
    followsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, school").in("id", authorIds),
    supabase.from("feed_profiles").select("*").in("user_id", authorIds),
    supabase.from("post_likes").select("post_id").in("post_id", ids),
    supabase.from("post_comments").select("post_id").in("post_id", ids),
    supabase.from("post_saves").select("post_id").in("post_id", ids),
    supabase.from("post_reposts").select("post_id").in("post_id", ids),
    currentUserId
      ? supabase
          .from("post_likes")
          .select("post_id")
          .in("post_id", ids)
          .eq("user_id", currentUserId)
      : Promise.resolve({ data: [] }),
    currentUserId
      ? supabase
          .from("post_saves")
          .select("post_id")
          .in("post_id", ids)
          .eq("user_id", currentUserId)
      : Promise.resolve({ data: [] }),
    currentUserId
      ? supabase
          .from("feed_follows")
          .select("following_id")
          .eq("follower_id", currentUserId)
          .in("following_id", authorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const feedMap = new Map((feedProfilesRes.data || []).map((p) => [p.user_id, p as FeedProfile]));
  const profMap = new Map(
    (profilesRes.data || []).map((p) => [
      p.id,
      { ...p, feed_profile: feedMap.get(p.id) || null } as Author,
    ]),
  );
  const count = (rows: { post_id: string }[] | null) => {
    const map = new Map<string, number>();
    (rows || []).forEach((row) => map.set(row.post_id, (map.get(row.post_id) || 0) + 1));
    return map;
  };
  const likeCount = count(likesRes.data);
  const commentCount = count(commentsRes.data);
  const saveCount = count(savesRes.data);
  const repostCount = count(repostsRes.data);
  const likedSet = new Set((myLikesRes.data || []).map((l) => l.post_id));
  const savedSet = new Set((mySavesRes.data || []).map((s) => s.post_id));
  const followSet = new Set((followsRes.data || []).map((f) => f.following_id));
  const signed = await Promise.all(
    posts.map(async (p) => {
      const urls = await signMedia(p.media_urls || []);
      return urls.map((url, i) => ({ url, type: p.media_types?.[i] || "image" }));
    }),
  );

  return posts.map((p, i) => ({
    ...p,
    author: profMap.get(p.author_id) || null,
    signed_media: signed[i],
    like_count: likeCount.get(p.id) || 0,
    comment_count: commentCount.get(p.id) || 0,
    save_count: saveCount.get(p.id) || 0,
    repost_count: repostCount.get(p.id) || 0,
    liked_by_me: likedSet.has(p.id),
    saved_by_me: savedSet.has(p.id),
    following_author: followSet.has(p.author_id),
  }));
}

function rankPosts(posts: Post[], viewerProfile?: FeedProfile | null) {
  const topics = new Set((viewerProfile?.feed_topics || []).map((t) => t.toLowerCase()));
  return [...posts]
    .map((post) => {
      const ageHours = Math.max(
        1,
        (Date.now() - new Date(post.approved_at || post.created_at).getTime()) / 36e5,
      );
      const affinity = post.tags?.some((tag) => topics.has(tag.toLowerCase())) ? 18 : 0;
      const followBoost = post.following_author ? 24 : 0;
      const engagement =
        (post.comment_count || 0) * 8 +
        (post.repost_count || 0) * 6 +
        (post.save_count || 0) * 4 +
        (post.like_count || 0) * 2;
      const recency = 36 / Math.pow(ageHours + 2, 0.65);
      return { ...post, score: recency + engagement + affinity + followBoost };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}

export async function fetchApprovedFeed(
  currentUserId: string | null,
  limit = 30,
  mode: "top" | "recent" = "top",
): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const hydrated = await hydrate((data || []) as Post[], currentUserId);
  if (mode === "recent") return hydrated;
  const viewerProfile = currentUserId ? await getFeedProfile(currentUserId) : null;
  return rankPosts(hydrated, viewerProfile);
}

export async function fetchMyPosts(userId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("author_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return hydrate((data || []) as Post[], userId);
}

export async function fetchPendingPosts(currentUserId: string | null): Promise<Post[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return hydrate((data || []) as Post[], currentUserId);
}

export async function toggleLike(postId: string, userId: string, currentlyLiked: boolean) {
  if (currentlyLiked)
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
  else await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
}

export async function toggleSave(postId: string, userId: string, currentlySaved: boolean) {
  if (currentlySaved)
    await supabase.from("post_saves").delete().eq("post_id", postId).eq("user_id", userId);
  else await supabase.from("post_saves").insert({ post_id: postId, user_id: userId });
}

export async function toggleFollow(
  followerId: string,
  followingId: string,
  currentlyFollowing: boolean,
) {
  if (followerId === followingId) return;
  if (currentlyFollowing)
    await supabase
      .from("feed_follows")
      .delete()
      .eq("follower_id", followerId)
      .eq("following_id", followingId);
  else
    await supabase
      .from("feed_follows")
      .insert({ follower_id: followerId, following_id: followingId });
}

export async function repostPost(postId: string, userId: string, note?: string) {
  const { error } = await supabase
    .from("post_reposts")
    .upsert(
      { post_id: postId, user_id: userId, note: note || null },
      { onConflict: "post_id,user_id" },
    );
  if (error) throw error;
}

export async function listComments(postId: string): Promise<Comment[]> {
  const { data: comments } = await supabase
    .from("post_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  const ids = Array.from(new Set((comments || []).map((c) => c.user_id)));
  const [{ data: profs }, { data: feeds }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name, email, school").in("id", ids),
        supabase.from("feed_profiles").select("*").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const feedMap = new Map((feeds || []).map((p) => [p.user_id, p as FeedProfile]));
  const map = new Map(
    (profs || []).map((p) => [p.id, { ...p, feed_profile: feedMap.get(p.id) || null } as Author]),
  );
  return (comments || []).map((c) => ({ ...c, author: map.get(c.user_id) || null })) as Comment[];
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
  const ext = file.name.split(".").pop() || "bin";
  const safe = file.name.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 60) || `upload.${ext}`;
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return { path, type: file.type.startsWith("video") ? "video" : "image" };
}

export async function createPost(input: {
  author_id: string;
  title?: string | null;
  content: string;
  media_urls: string[];
  media_types: string[];
  tags: string[];
  location?: string | null;
  visibility?: FeedVisibility;
}) {
  const { data, error } = await supabase
    .from("posts")
    .insert({ ...input, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePost(
  id: string,
  patch: Partial<
    Pick<
      Post,
      "title" | "content" | "media_urls" | "media_types" | "tags" | "location" | "visibility"
    >
  >,
) {
  const { data, error } = await supabase
    .from("posts")
    .update({ ...patch, status: "pending" })
    .eq("id", id)
    .select()
    .single();
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
