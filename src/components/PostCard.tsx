import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, MapPin, Loader2, Send, BadgeCheck } from "lucide-react";
import { type Post, toggleLike, listComments, addComment } from "@/lib/feed";
import { levelFromXP } from "@/lib/constants";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

type FeedComment = Awaited<ReturnType<typeof listComments>>[number];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "հենց նոր";
  if (m < 60) return `${m} ր`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ժ`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} օր`;
  return new Date(iso).toLocaleDateString("hy-AM", { day: "numeric", month: "short" });
}

/** Author avatar (brand gradient + initial). */
function Avatar({ name, size = 10 }: { name: string; size?: 7 | 10 }) {
  const initial = (name || "U").slice(0, 1).toUpperCase();
  const cls = size === 10 ? "w-10 h-10 text-sm" : "w-7 h-7 text-xs";
  return (
    <div
      className={`${cls} rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-semibold shrink-0`}
    >
      {initial}
    </div>
  );
}

/** Adaptive media mosaic: 1 full-width, 2 halves, 3 = hero + pair, 4+ = 2×2 with "+N". */
function MediaMosaic({ media }: { media: { url: string; type: string }[] }) {
  const shown = media.slice(0, 4);
  const extra = media.length - 4;

  const Cell = ({ m, className }: { m: { url: string; type: string }; className: string }) => (
    <div className={`bg-secondary overflow-hidden ${className}`}>
      {m.type === "video" ? (
        <video
          src={m.url}
          controls
          playsInline
          preload="metadata"
          aria-label="Գրառման կցված տեսանյութ"
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={m.url}
          alt="Գրառման կցված նկար"
          loading="lazy"
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );

  if (shown.length === 1)
    return (
      <div className="mt-3">
        <Cell m={shown[0]} className="w-full max-h-[520px]" />
      </div>
    );
  if (shown.length === 2)
    return (
      <div className="mt-3 grid grid-cols-2 gap-0.5">
        {shown.map((m, i) => (
          <Cell key={i} m={m} className="aspect-square" />
        ))}
      </div>
    );
  if (shown.length === 3)
    return (
      <div className="mt-3 grid grid-cols-2 gap-0.5">
        <Cell m={shown[0]} className="row-span-2 h-full" />
        <Cell m={shown[1]} className="aspect-square" />
        <Cell m={shown[2]} className="aspect-square" />
      </div>
    );
  return (
    <div className="mt-3 grid grid-cols-2 gap-0.5">
      {shown.map((m, i) => (
        <div key={i} className="relative">
          <Cell m={m} className="aspect-square" />
          {i === 3 && extra > 0 && (
            <div className="absolute inset-0 bg-black/50 grid place-items-center text-white font-semibold text-lg pointer-events-none">
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
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
  const [likes, setLikes] = useState(post.like_count || 0);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [burst, setBurst] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => {
    setLiked(!!post.liked_by_me);
    setLikes(post.like_count || 0);
    setCommentCount(post.comment_count || 0);
  }, [post.id, post.liked_by_me, post.like_count, post.comment_count]);

  async function setLike(next: boolean) {
    if (!currentUserId || next === liked) return;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    if (next) {
      setBurst(true);
      setTimeout(() => setBurst(false), 450);
    }
    try {
      await toggleLike(post.id, currentUserId, !next);
    } catch {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    }
  }

  /** Double-tap media to like. */
  function onMediaTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) void setLike(true);
    lastTap.current = now;
  }

  async function openComments() {
    setShowComments((v) => !v);
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
      setCommentCount((n) => n + 1);
      onChanged?.();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց ուղարկել"));
    } finally {
      setPosting(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/feed#post-${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title || "Գրառում",
          text: post.content.slice(0, 120),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Հղումը պատճենվեց");
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  const name = post.author?.full_name || "Օգտատեր";
  const level = levelFromXP(post.author?.xp || 0);
  const longText = post.content.length > 420;
  const actionBtn =
    "min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm font-medium transition-colors";

  return (
    <article
      id={`post-${post.id}`}
      className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden min-w-0"
    >
      {/* Author row */}
      <header className="flex items-center gap-3 p-3 sm:p-4 pb-2 min-w-0">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-sm truncate">{name}</span>
            <span className="inline-flex items-center gap-0.5 shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              <BadgeCheck className="w-3 h-3" /> {level.level}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 flex-wrap min-w-0">
            <span className="truncate">{level.name}</span>
            <span>·</span>
            <span>{timeAgo(post.approved_at || post.created_at)}</span>
            {post.location && (
              <>
                <span>·</span>
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{post.location}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content with see-more clamp */}
      {post.title && (
        <h2 className="px-3 sm:px-4 font-display text-base sm:text-lg font-semibold break-words">
          {post.title}
        </h2>
      )}
      {post.content && (
        <div className="px-3 sm:px-4 pt-0.5">
          <p
            className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
              longText && !expanded ? "line-clamp-5" : ""
            }`}
          >
            {post.content}
          </p>
          {longText && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-semibold text-primary hover:underline mt-1"
            >
              {expanded ? "Փակել" : "…ավելին"}
            </button>
          )}
        </div>
      )}

      {/* Media (double-tap to like) */}
      {(post.signed_media || []).length > 0 && (
        <div onPointerDown={onMediaTap} className="select-none">
          <MediaMosaic media={post.signed_media!} />
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="px-3 sm:px-4 pt-2.5 flex flex-wrap gap-1.5 min-w-0">
          {post.tags.map((t) => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground break-words"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Social proof row */}
      {(likes > 0 || commentCount > 0) && (
        <div className="px-3 sm:px-4 pt-2.5 pb-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {likes > 0 && (
              <>
                <span className="inline-grid place-items-center w-4 h-4 rounded-full bg-destructive/15">
                  <Heart className="w-2.5 h-2.5 fill-destructive text-destructive" />
                </span>
                {likes}
              </>
            )}
          </span>
          {commentCount > 0 && (
            <button onClick={openComments} className="hover:underline">
              {commentCount} մեկնաբանություն
            </button>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-1 px-2 sm:px-3 py-1.5 mt-1 border-t border-border min-w-0">
        <button
          onClick={() => void setLike(!liked)}
          className={`${actionBtn} ${
            liked
              ? "text-destructive"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Heart
            className={`w-[18px] h-[18px] ${liked ? "fill-current" : ""} ${burst ? "like-burst" : ""}`}
          />
          <span className="hidden min-[420px]:inline">Հավանել</span>
        </button>
        <button
          onClick={openComments}
          className={`${actionBtn} text-muted-foreground hover:bg-secondary hover:text-foreground`}
        >
          <MessageCircle className="w-[18px] h-[18px]" />
          <span className="hidden min-[420px]:inline">Մեկնաբանել</span>
        </button>
        <button
          onClick={share}
          className={`${actionBtn} text-muted-foreground hover:bg-secondary hover:text-foreground`}
        >
          <Share2 className="w-[18px] h-[18px]" />
          <span className="hidden min-[420px]:inline">Կիսվել</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-3 sm:px-4 pb-3 border-t border-border bg-secondary/30">
          {loadingComments ? (
            <div className="py-4 text-center">
              <Loader2 className="w-4 h-4 animate-spin inline text-primary" />
            </div>
          ) : (
            <ul className="space-y-2 py-3">
              {comments.length === 0 && (
                <li className="text-xs text-muted-foreground">Եղիր առաջինը, ով կմեկնաբանի։</li>
              )}
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-start min-w-0"
                >
                  <Avatar name={c.author?.full_name || "Օ"} size={7} />
                  <div className="bg-card border border-border rounded-2xl rounded-tl-md px-3 py-2 min-w-0">
                    <div className="text-[11px] font-semibold break-words">
                      {c.author?.full_name || "Օգտատեր"}
                    </div>
                    <div className="text-sm break-words whitespace-pre-wrap">{c.content}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {currentUserId && post.status !== "approved" && (
            <p className="text-xs text-muted-foreground pb-2">
              Մեկնաբանությունները հասանելի կլինեն հաստատվելուց հետո։
            </p>
          )}
          {currentUserId && post.status === "approved" && (
            <form onSubmit={submitComment} className="flex items-center gap-2 pb-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Գրիր մեկնաբանություն…"
                aria-label="Մեկնաբանություն"
                maxLength={1000}
                className="flex-1 min-w-0 px-3.5 py-2 rounded-full border border-input bg-background text-sm min-h-[44px] outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                disabled={!draft.trim() || posting}
                aria-label="Ուղարկել"
                className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground disabled:opacity-50"
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

export function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: {
      label: "Սպասում է հաստատման",
      cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    },
    approved: { label: "Հաստատված", cls: "bg-success/10 text-success border-success/30" },
    rejected: { label: "Մերժված", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
