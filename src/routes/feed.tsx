import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { PostCard } from "@/components/PostCard";
import { fetchApprovedFeed, type Post } from "@/lib/feed";
import { Loader2, Plus, Newspaper } from "lucide-react";

export const Route = createFileRoute("/feed")({ component: Feed });

function Feed() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[] | null>(null);

  async function load() {
    try { setPosts(await fetchApprovedFeed(user?.id || null)); } catch { setPosts([]); }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    void load();
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-2xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-5 sm:py-8 pb-40 md:pb-10">
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-1"><Newspaper className="w-3.5 h-3.5" /> Համայնք</div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight break-words">Համայնքի ֆիդ</h1>
            <p className="text-sm text-muted-foreground mt-1">Հաստատված գրառումներ՝ ուսանողներից։</p>
          </div>
          <Link to="/feed/create" className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 min-h-[44px]">
            <Plus className="w-4 h-4" /> Նոր
          </Link>
        </div>

        {posts === null ? (
          <div className="grid place-items-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-2xl">
            <p className="text-muted-foreground">Դեռ հաստատված գրառումներ չկան։</p>
            <Link to="/feed/create" className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> Կիսվիր առաջինը
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} currentUserId={user?.id || null} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
