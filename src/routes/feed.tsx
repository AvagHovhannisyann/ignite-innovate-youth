import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, StatusBadge } from "@/components/PostCard";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { dailyPrompt } from "@/lib/feed-prompts";
import { fetchApprovedFeed, fetchMyPending, type Post } from "@/lib/feed";
import { levelFromXP } from "@/lib/constants";
import { Newspaper, Flame, Trophy, MessageCircleHeart, Lightbulb } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/feed")({ component: Feed });

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary" />
        <div className="space-y-1.5 flex-1">
          <div className="h-3 bg-secondary rounded w-1/3" />
          <div className="h-2.5 bg-secondary rounded w-1/4" />
        </div>
      </div>
      <div className="h-3 bg-secondary rounded w-full" />
      <div className="h-3 bg-secondary rounded w-5/6" />
      <div className="h-40 bg-secondary rounded-xl" />
    </div>
  );
}

function Feed() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [mine, setMine] = useState<Post[]>([]);
  const [profile, setProfile] = useState<Pick<
    Tables<"profiles">,
    "full_name" | "email" | "xp"
  > | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    try {
      const [approved, pending] = await Promise.all([
        fetchApprovedFeed(user.id),
        fetchMyPending(user.id),
      ]);
      setPosts(approved);
      setMine(pending);
    } catch {
      setPosts([]);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    void load();
    supabase
      .from("profiles")
      .select("full_name,email,xp")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, nav]);

  // Tag cloud from the loaded feed (top 8 by frequency).
  const topTags = useMemo(() => {
    const counts = new Map<string, number>();
    (posts || []).forEach((p) => p.tags?.forEach((t) => counts.set(t, (counts.get(t) || 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([t]) => t);
  }, [posts]);

  const visible = useMemo(
    () => (tag ? (posts || []).filter((p) => p.tags?.includes(tag)) : posts || []),
    [posts, tag],
  );

  const myApprovedCount = useMemo(
    () => (posts || []).filter((p) => p.author_id === user?.id).length,
    [posts, user?.id],
  );
  const myLikes = useMemo(
    () =>
      (posts || [])
        .filter((p) => p.author_id === user?.id)
        .reduce((s, p) => s + (p.like_count || 0), 0),
    [posts, user?.id],
  );

  const level = levelFromXP(profile?.xp || 0);
  const displayName = profile?.full_name || profile?.email || "Ուսանող";

  return (
    <div className="max-w-6xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-4 sm:py-6 pb-40 md:pb-10">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* ------------------------------------------------ main column */}
        <div className="min-w-0 space-y-4 max-w-2xl w-full mx-auto lg:mx-0">
          {user && (
            <FeedComposer
              key={prefill || "plain"}
              userId={user.id}
              displayName={displayName}
              prefill={prefill}
              onPosted={() => {
                setPrefill(null);
                void load();
              }}
            />
          )}

          {/* Tag filter chips */}
          {topTags.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              <button
                onClick={() => setTag(null)}
                className={`shrink-0 text-xs px-3 min-h-[36px] rounded-full border transition-colors ${
                  !tag
                    ? "bg-primary text-primary-foreground border-transparent font-semibold"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                Բոլորը
              </button>
              {topTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={`shrink-0 text-xs px-3 min-h-[36px] rounded-full border transition-colors ${
                    tag === t
                      ? "bg-primary text-primary-foreground border-transparent font-semibold"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {/* Own pending/rejected posts pinned on top */}
          {mine.length > 0 && (
            <div className="space-y-3">
              {mine.map((p) => (
                <div key={p.id} className="relative">
                  <div className="absolute -top-2 left-4 z-10">
                    <StatusBadge status={p.status} />
                  </div>
                  <div className={p.status === "rejected" ? "opacity-75" : "opacity-95"}>
                    <PostCard post={p} currentUserId={user?.id || null} onChanged={load} />
                  </div>
                  {p.status === "rejected" && p.rejection_reason && (
                    <p className="text-xs text-destructive mt-1 px-4">
                      Պատճառ՝ {p.rejection_reason} —{" "}
                      <Link to="/feed/create" search={{ edit: p.id }} className="underline">
                        խմբագրել և կրկին ուղարկել
                      </Link>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Feed */}
          {posts === null ? (
            <div className="space-y-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 px-4 card-base rounded-2xl">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-3">
                <Newspaper className="w-5 h-5 text-muted-foreground" />
              </div>
              <h3 className="font-display text-base font-semibold mb-1">
                {tag ? `#${tag} թեգով գրառումներ չկան։` : "Ֆիդը դեռ դատարկ է։"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {tag
                  ? "Փորձիր այլ թեգ կամ գրիր առաջինը։"
                  : "Հենց դու կարող ես սկսել խոսակցությունը։"}
              </p>
              {!tag && (
                <div className="flex flex-wrap justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <button
                      key={i}
                      onClick={() => setPrefill(dailyPrompt(i))}
                      className="text-xs px-3 py-2 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      {dailyPrompt(i)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((p) => (
                <PostCard key={p.id} post={p} currentUserId={user?.id || null} onChanged={load} />
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------ right rail (desktop) */}
        <aside className="hidden lg:block space-y-4 sticky top-20">
          {/* Impact card */}
          <div className="card-base rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-semibold">
                {(displayName || "U").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{displayName}</div>
                <div className="text-[11px] text-muted-foreground">
                  Մակարդակ {level.level} · {level.name}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-secondary/60 p-2.5">
                <div className="font-bold text-lg leading-none">{myApprovedCount}</div>
                <div className="text-[10px] text-muted-foreground mt-1">գրառում ֆիդում</div>
              </div>
              <div className="rounded-xl bg-secondary/60 p-2.5">
                <div className="font-bold text-lg leading-none">{myLikes}</div>
                <div className="text-[10px] text-muted-foreground mt-1">ստացած հավանում</div>
              </div>
            </div>
          </div>

          {/* Daily prompt card */}
          <div className="card-base rounded-2xl p-4 border-primary/25 bg-primary/[0.03]">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary mb-2">
              <Lightbulb className="w-4 h-4" /> Այսօրվա հարցը
            </div>
            <p className="text-sm leading-relaxed mb-3">{dailyPrompt()}</p>
            <button
              onClick={() => {
                setPrefill(dailyPrompt());
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 min-h-[40px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              <MessageCircleHeart className="w-4 h-4" /> Պատասխանել
            </button>
          </div>

          {/* Community pulse */}
          <div className="card-base rounded-2xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              <Flame className="w-4 h-4 text-accent" /> Համայնքի զարկերակ
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Գրառում այս ֆիդում</span>
                <span className="font-semibold">{posts?.length ?? "—"}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Ակտիվ թեգեր</span>
                <span className="font-semibold">{topTags.length}</span>
              </li>
            </ul>
            <Link
              to="/community"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Trophy className="w-3.5 h-3.5" /> Տես համայնքի ձեռքբերումները
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
