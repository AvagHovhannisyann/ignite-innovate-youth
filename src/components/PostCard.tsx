import { useEffect, useState } from "react";
import {
  Bookmark,
  Clock,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Repeat2,
  Send,
  Share2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  addComment,
  listComments,
  repostPost,
  toggleFollow,
  toggleLike,
  toggleSave,
  type Comment,
  type Post,
} from "@/lib/feed";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "հենց նոր";
  if (minutes < 60) return `${minutes}ր առաջ`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ժ առաջ`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}օր առաջ`;
  return new Date(iso).toLocaleDateString();
}

export function PostCard({
  post,
  currentUserId,
  onChanged,
}: {
  post: Post;
  currentUserId: string | null;
  onChanged?: () => void;
}) {
  const [liked, setLiked] = useState(!!post.liked_by_me);
  const [saved, setSaved] = useState(!!post.saved_by_me);
  const [following, setFollowing] = useState(!!post.following_author);
  const [likes, setLikes] = useState(post.like_count || 0);
  const [saves, setSaves] = useState(post.save_count || 0);
  const [reposts, setReposts] = useState(post.repost_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const isMine = currentUserId === post.author_id;

  useEffect(() => {
    setLiked(!!post.liked_by_me);
    setSaved(!!post.saved_by_me);
    setFollowing(!!post.following_author);
    setLikes(post.like_count || 0);
    setSaves(post.save_count || 0);
    setReposts(post.repost_count || 0);
  }, [
    post.id,
    post.liked_by_me,
    post.saved_by_me,
    post.following_author,
    post.like_count,
    post.save_count,
    post.repost_count,
  ]);

  async function onLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      await toggleLike(post.id, currentUserId, !next);
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  }

  async function onSave() {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next);
    setSaves((n) => n + (next ? 1 : -1));
    try {
      await toggleSave(post.id, currentUserId, !next);
    } catch {
      setSaved(!next);
      setSaves((n) => n + (next ? -1 : 1));
    }
  }

  async function onFollow() {
    if (!currentUserId || isMine) return;
    const next = !following;
    setFollowing(next);
    try {
      await toggleFollow(currentUserId, post.author_id, !next);
      onChanged?.();
    } catch {
      setFollowing(!next);
    }
  }

  async function onRepost() {
    if (!currentUserId) return;
    await repostPost(post.id, currentUserId);
    setReposts((n) => n + 1);
  }

  async function loadComments() {
    setShowComments((value) => !value);
    if (comments.length || loadingComments) return;
    setLoadingComments(true);
    try {
      setComments(await listComments(post.id));
    } finally {
      setLoadingComments(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUserId || !draft.trim() || posting) return;
    setPosting(true);
    try {
      await addComment(post.id, currentUserId, draft.trim());
      setDraft("");
      setComments(await listComments(post.id));
      onChanged?.();
    } finally {
      setPosting(false);
    }
  }

  async function share() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/feed#post-${post.id}` : "";
    try {
      if (navigator.share)
        await navigator.share({ title: post.title || "Գրառում", text: post.content, url });
      else {
        await navigator.clipboard.writeText(url);
        alert("Հղումը պատճենվեց");
      }
    } catch {
      // User cancelled native share.
    }
  }

  const name = post.author?.full_name || "Օգտատեր";
  const headline =
    post.author?.feed_profile?.headline || post.author?.school || "Էջմիածնի երիտասարդական համայնք";
  const initial = (name || post.author?.email || "U").slice(0, 1).toUpperCase();

  return (
    <article
      id={`post-${post.id}`}
      className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden min-w-0 animate-rise"
    >
      <header className="flex items-start gap-3 p-3 sm:p-4 min-w-0">
        <div className="w-12 h-12 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-semibold shrink-0 shadow-soft">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm break-words">{name}</div>
              <div className="text-[12px] text-muted-foreground line-clamp-2 break-words">
                {headline}
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap min-w-0 mt-0.5">
                <Clock className="w-3 h-3 shrink-0" />{" "}
                <span>{timeAgo(post.approved_at || post.created_at)}</span>
                {post.location && (
                  <>
                    <span>·</span>
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="break-words">{post.location}</span>
                  </>
                )}
                {post.visibility && (
                  <>
                    <span>·</span>
                    <Users className="w-3 h-3 shrink-0" />
                    <span>{post.visibility === "connections" ? "կապեր" : "ուսանողներ"}</span>
                  </>
                )}
              </div>
            </div>
            {!isMine && currentUserId && (
              <button
                onClick={onFollow}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> {following ? "Հետևում ես" : "Հետևել"}
              </button>
            )}
          </div>
        </div>
      </header>

      {post.title && (
        <h2 className="px-3 sm:px-4 font-display text-lg font-semibold break-words">
          {post.title}
        </h2>
      )}
      {post.content && (
        <p className="px-3 sm:px-4 pt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}

      {(post.signed_media || []).length > 0 && (
        <div
          className={`mt-3 grid gap-1 ${(post.signed_media || []).length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {(post.signed_media || []).map((media, index) => (
            <div
              key={`${media.url}-${index}`}
              className="bg-secondary aspect-square overflow-hidden"
            >
              {media.type === "video" ? (
                <video
                  src={media.url}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={media.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="px-3 sm:px-4 pt-3 flex flex-wrap gap-1.5 min-w-0">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground break-words"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="px-3 sm:px-4 pt-3 text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
        <span>{likes} հավանում</span>
        <span>·</span>
        <span>{post.comment_count || comments.length} մեկնաբանություն</span>
        <span>·</span>
        <span>{reposts} վերատարածում</span>
        <span>·</span>
        <span>{saves} պահում</span>
      </div>

      <div className="grid grid-cols-5 gap-1 px-2 sm:px-3 py-2 mt-2 border-t border-border min-w-0">
        <ActionButton
          onClick={onLike}
          active={liked}
          label="Հավանել"
          icon={<Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />}
        />
        <ActionButton
          onClick={loadComments}
          active={showComments}
          label="Մեկնաբանել"
          icon={<MessageCircle className="w-4 h-4" />}
        />
        <ActionButton onClick={onRepost} label="Repost" icon={<Repeat2 className="w-4 h-4" />} />
        <ActionButton
          onClick={onSave}
          active={saved}
          label="Պահել"
          icon={<Bookmark className={`w-4 h-4 ${saved ? "fill-current" : ""}`} />}
        />
        <ActionButton onClick={share} label="Կիսվել" icon={<Share2 className="w-4 h-4" />} />
      </div>

      {showComments && (
        <div className="px-3 sm:px-4 pb-3 border-t border-border bg-secondary/30">
          {loadingComments ? (
            <div className="py-4 text-center">
              <Loader2 className="w-4 h-4 animate-spin inline" />
            </div>
          ) : (
            <ul className="space-y-2 py-3">
              {comments.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  Դեռ մեկնաբանություն չկա։ Սկսիր մասնագիտական զրույցը։
                </li>
              )}
              {comments.map((comment) => (
                <li
                  key={comment.id}
                  className="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-start min-w-0"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">
                    {(comment.author?.full_name || comment.author?.email || "U")
                      .slice(0, 1)
                      .toUpperCase()}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-2 min-w-0">
                    <div className="text-[11px] font-medium break-words">
                      {comment.author?.full_name || "Օգտատեր"}
                    </div>
                    <div className="text-sm break-words whitespace-pre-wrap">{comment.content}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {currentUserId && (
            <form onSubmit={submitComment} className="flex items-center gap-2 pb-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ավելացրու արժեքավոր մեկնաբանություն…"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm min-h-[40px]"
              />
              <button
                disabled={!draft.trim() || posting}
                className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                {posting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-[40px] inline-flex items-center justify-center gap-1.5 px-1.5 py-2 rounded-lg text-xs sm:text-sm transition-colors ${active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
    >
      {icon}
      <span className="hidden min-[420px]:inline truncate">{label}</span>
    </button>
  );
}

export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Սպասում է հաստատման", cls: "bg-amber-100 text-amber-900 border-amber-200" },
    approved: { label: "Հաստատված", cls: "bg-success/10 text-success border-success/30" },
    rejected: { label: "Մերժված", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const item = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${item.cls}`}
    >
      {item.label}
    </span>
  );
}
