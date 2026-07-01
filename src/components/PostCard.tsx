import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Share2, MapPin, Clock, Send, Loader2, MoreHorizontal } from "lucide-react";
import { type Post, toggleLike, listComments, addComment } from "@/lib/feed";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "հենց նոր";
  if (m < 60) return `${m}ր առաջ`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ժ առաջ`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}օր առաջ`;
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
  const [likes, setLikes] = useState(post.like_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => { setLiked(!!post.liked_by_me); setLikes(post.like_count || 0); }, [post.id, post.liked_by_me, post.like_count]);

  async function onLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next); setLikes((n) => n + (next ? 1 : -1));
    try { await toggleLike(post.id, currentUserId, !next); } catch { setLiked(!next); setLikes((n) => n + (next ? -1 : 1)); }
  }

  async function loadComments() {
    setShowComments((v) => !v);
    if (comments.length || loadingComments) return;
    setLoadingComments(true);
    try { setComments(await listComments(post.id)); } finally { setLoadingComments(false); }
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
    } finally { setPosting(false); }
  }

  async function share() {
    const url = typeof window !== "undefined" ? `${window.location.origin}/dashboard#post-${post.id}` : "";
    try {
      if (navigator.share) await navigator.share({ title: post.title || "Գրառում", text: post.content, url });
      else { await navigator.clipboard.writeText(url); alert("Հղումը պատճենվեց"); }
    } catch {}
  }

  const initial = (post.author?.full_name || post.author?.email || "U").slice(0, 1).toUpperCase();

  return (
    <article id={`post-${post.id}`} className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden min-w-0">
      <header className="flex items-center gap-3 p-3 sm:p-4 min-w-0">
        <div className="w-10 h-10 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-semibold shrink-0">{initial}</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm break-words">{post.author?.full_name || "Օգտատեր"}</div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap min-w-0">
            <Clock className="w-3 h-3 shrink-0" /> <span>{timeAgo(post.approved_at || post.created_at)}</span>
            {post.location && (<><span>·</span><MapPin className="w-3 h-3 shrink-0" /><span className="break-words">{post.location}</span></>)}
          </div>
        </div>
      </header>

      {post.title && <h2 className="px-3 sm:px-4 font-display text-lg font-semibold break-words">{post.title}</h2>}
      {post.content && <p className="px-3 sm:px-4 pt-1 text-sm leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>}

      {(post.signed_media || []).length > 0 && (
        <div className={`mt-3 grid gap-1 ${post.signed_media!.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.signed_media!.map((m, i) => (
            <div key={i} className="bg-secondary aspect-square overflow-hidden">
              {m.type === "video" ? (
                <video src={m.url} controls playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={m.url} alt="" loading="lazy" className="w-full h-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      {post.tags?.length > 0 && (
        <div className="px-3 sm:px-4 pt-3 flex flex-wrap gap-1.5 min-w-0">
          {post.tags.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground break-words">#{t}</span>)}
        </div>
      )}

      <div className="flex items-center gap-1 px-2 sm:px-3 py-2 mt-2 border-t border-border min-w-0">
        <button onClick={onLike} className={`min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${liked ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}>
          <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} /> {likes}
        </button>
        <button onClick={loadComments} className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground">
          <MessageCircle className="w-4 h-4" /> {post.comment_count || 0}
        </button>
        <button onClick={share} className="ml-auto min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground">
          <Share2 className="w-4 h-4" /> Կիսվել
        </button>
      </div>

      {showComments && (
        <div className="px-3 sm:px-4 pb-3 border-t border-border bg-secondary/30">
          {loadingComments ? (
            <div className="py-4 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
          ) : (
            <ul className="space-y-2 py-3">
              {comments.length === 0 && <li className="text-xs text-muted-foreground">Դեռ մեկնաբանություն չկա։</li>}
              {comments.map((c) => (
                <li key={c.id} className="text-sm grid grid-cols-[auto_minmax(0,1fr)] gap-2 items-start min-w-0">
                  <div className="w-7 h-7 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">
                    {(c.author?.full_name || c.author?.email || "U").slice(0,1).toUpperCase()}
                  </div>
                  <div className="bg-card border border-border rounded-xl p-2 min-w-0">
                    <div className="text-[11px] font-medium break-words">{c.author?.full_name || "Օգտատեր"}</div>
                    <div className="text-sm break-words whitespace-pre-wrap">{c.content}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {currentUserId && (
            <form onSubmit={submitComment} className="flex items-center gap-2 pb-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Գրիր մեկնաբանություն…" className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm min-h-[40px]" />
              <button disabled={!draft.trim() || posting} className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
    pending: { label: "Սպասում է հաստատման", cls: "bg-amber-100 text-amber-900 border-amber-200" },
    approved: { label: "Հաստատված", cls: "bg-success/10 text-success border-success/30" },
    rejected: { label: "Մերժված", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  };
  const s = map[status];
  return <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>;
}
