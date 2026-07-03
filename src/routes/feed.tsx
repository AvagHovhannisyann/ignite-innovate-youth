import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PostCard } from "@/components/PostCard";
import {
  fetchApprovedFeed,
  getFeedProfile,
  upsertFeedProfile,
  type FeedProfile,
  type Post,
} from "@/lib/feed";
import { ALL_INTERESTS } from "@/lib/constants";
import {
  BriefcaseBusiness,
  Loader2,
  Newspaper,
  Plus,
  Search,
  Settings2,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/feed")({ component: Feed });

type SortMode = "top" | "recent";

function Feed() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedProfile, setFeedProfile] = useState<FeedProfile | null>(null);
  const [sort, setSort] = useState<SortMode>("top");
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode = sort) => {
      if (!user) return;
      setRefreshing(true);
      try {
        const [nextPosts, profile] = await Promise.all([
          fetchApprovedFeed(user.id, 60, mode),
          getFeedProfile(user.id),
        ]);
        setPosts(nextPosts);
        setFeedProfile(profile);
        setShowSetup(!profile.setup_completed);
      } catch {
        setPosts([]);
      } finally {
        setRefreshing(false);
      }
    },
    [sort, user],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    void load(sort);
  }, [user, loading, nav, sort, load]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    (posts || []).forEach((post) =>
      (post.tags || []).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)),
    );
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (posts || []).filter((post) => {
      const matchesTag = selectedTag ? post.tags?.includes(selectedTag) : true;
      const haystack =
        `${post.title || ""} ${post.content} ${post.author?.full_name || ""} ${(post.tags || []).join(" ")}`.toLowerCase();
      return matchesTag && (!q || haystack.includes(q));
    });
  }, [posts, query, selectedTag]);

  return (
    <div className="mx-auto w-full max-w-7xl px-3 min-[380px]:px-4 sm:px-6 py-4 sm:py-6 pb-36 md:pb-8">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)_300px] gap-5 items-start">
        <aside className="hidden lg:block sticky top-20 space-y-4">
          <ProfilePanel profile={feedProfile} onSetup={() => setShowSetup(true)} />
          <QuickTips />
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="card-base rounded-2xl p-3 sm:p-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-hero text-primary-foreground grid place-items-center font-bold shrink-0">
                {(feedProfile?.headline || user?.email || "U").slice(0, 1).toUpperCase()}
              </div>
              <Link
                to="/feed/create"
                className="flex-1 min-h-[44px] px-4 rounded-full border border-border bg-background text-muted-foreground hover:bg-secondary flex items-center text-sm"
              >
                Կիսվիր փորձով, նախագծով կամ հնարավորությամբ…
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-xs sm:text-sm">
              <Link
                to="/feed/create"
                className="min-h-[40px] rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4 text-primary" /> Գրառում
              </Link>
              <Link
                to="/feed/create"
                search={{ media: "image" } as never}
                className="min-h-[40px] rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-accent-foreground" /> Մեդիա
              </Link>
              <button
                onClick={() => setShowSetup(true)}
                className="min-h-[40px] rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-2"
              >
                <Settings2 className="w-4 h-4" /> Պրոֆիլ
              </button>
            </div>
          </section>

          <section className="card-base rounded-2xl p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Որոնել ֆիդում…"
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-input bg-background text-sm"
                />
              </div>
              <div className="inline-flex rounded-xl bg-secondary p-1 shrink-0">
                <button
                  onClick={() => setSort("top")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${sort === "top" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
                >
                  Քեզ համար
                </button>
                <button
                  onClick={() => setSort("recent")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold ${sort === "recent" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
                >
                  Նորերը
                </button>
              </div>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`text-xs px-2.5 py-1 rounded-full border ${selectedTag === tag ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </section>

          {posts === null ? (
            <FeedSkeleton />
          ) : filteredPosts.length === 0 ? (
            <EmptyFeed />
          ) : (
            <div className="space-y-4">
              {refreshing && (
                <div className="text-center text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> Թարմացվում է…
                </div>
              )}
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.id || null}
                  onChanged={() => void load()}
                />
              ))}
            </div>
          )}
        </main>

        <aside className="hidden lg:block sticky top-20 space-y-4">
          <NetworkPanel />
          <TopicPanel topics={feedProfile?.feed_topics || []} />
        </aside>
      </div>
      {showSetup && user && (
        <FeedSetupModal
          userId={user.id}
          profile={feedProfile}
          onClose={() => setShowSetup(false)}
          onSaved={(profile) => {
            setFeedProfile(profile);
            setShowSetup(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ProfilePanel({ profile, onSetup }: { profile: FeedProfile | null; onSetup: () => void }) {
  return (
    <section className="card-base rounded-2xl overflow-hidden">
      <div className="h-16 bg-gradient-hero" />
      <div className="p-4 -mt-7">
        <div className="w-14 h-14 rounded-full bg-card border-4 border-card shadow-soft grid place-items-center font-bold text-primary">
          {(profile?.headline || "U").slice(0, 1).toUpperCase()}
        </div>
        <h2 className="font-semibold mt-3 break-words">
          {profile?.headline || "Ստեղծիր ֆիդի պրոֆիլ"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1 break-words">
          {profile?.about ||
            "Ավելացրու վերնագիր, թեմաներ և նպատակներ, որպեսզի ֆիդը դառնա անհատականացված։"}
        </p>
        <button
          onClick={onSetup}
          className="mt-3 w-full min-h-[40px] rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          Խմբագրել ֆիդ պրոֆիլը
        </button>
      </div>
    </section>
  );
}

function QuickTips() {
  return (
    <section className="card-base rounded-2xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" /> LinkedIn որակի սկզբունքներ
      </h3>
      <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
        <li>• Սկսիր ուժեղ առաջին նախադասությամբ։</li>
        <li>• Գրիր կարճ պարբերություններով։</li>
        <li>• Հարց տուր՝ մեկնաբանությունները ակտիվացնելու համար։</li>
        <li>• Օգտագործիր 1–3 կոնկրետ թեգ։</li>
      </ul>
    </section>
  );
}

function NetworkPanel() {
  return (
    <section className="card-base rounded-2xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" /> Համայնքային գործընթաց
      </h3>
      <p className="text-xs text-muted-foreground mt-2">
        Գրառումները անցնում են ադմինի հաստատում, ապա դասավորվում են ըստ թարմության, թեմաների,
        հետևումների և իմաստալից ներգրավվածության։
      </p>
    </section>
  );
}

function TopicPanel({ topics }: { topics: string[] }) {
  return (
    <section className="card-base rounded-2xl p-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <BriefcaseBusiness className="w-4 h-4 text-primary" /> Քո թեմաները
      </h3>
      <div className="flex flex-wrap gap-2 mt-3">
        {(topics.length ? topics : ALL_INTERESTS.slice(0, 6)).map((topic) => (
          <span
            key={topic}
            className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground"
          >
            {topic}
          </span>
        ))}
      </div>
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="card-base rounded-2xl p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-full bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-secondary rounded w-1/3" />
              <div className="h-3 bg-secondary rounded w-2/3" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 bg-secondary rounded" />
            <div className="h-4 bg-secondary rounded w-5/6" />
            <div className="h-52 bg-secondary rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="text-center py-14 px-4 card-base rounded-2xl animate-rise">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-3">
        <Newspaper className="w-5 h-5 text-muted-foreground" />
      </div>
      <h3 className="font-display text-base font-semibold mb-1">
        Ֆիդում դեռ համապատասխան գրառումներ չկան։
      </h3>
      <p className="text-sm text-muted-foreground">
        Փոխիր որոնումը կամ կիսվիր առաջին օգտակար գրառումով։
      </p>
      <Link
        to="/feed/create"
        className="inline-flex items-center justify-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover-lift min-h-[44px]"
      >
        <Plus className="w-4 h-4" /> Կիսվիր առաջինը
      </Link>
    </div>
  );
}

function FeedSetupModal({
  userId,
  profile,
  onClose,
  onSaved,
}: {
  userId: string;
  profile: FeedProfile | null;
  onClose: () => void;
  onSaved: (profile: FeedProfile) => void;
}) {
  const [headline, setHeadline] = useState(profile?.headline || "");
  const [about, setAbout] = useState(profile?.about || "");
  const [topics, setTopics] = useState<string[]>(profile?.feed_topics || []);
  const [lookingFor, setLookingFor] = useState<string[]>(profile?.looking_for || []);
  const [saving, setSaving] = useState(false);
  const toggle = (value: string, setter: (items: string[]) => void, current: string[]) =>
    setter(
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  async function save() {
    setSaving(true);
    const saved = await upsertFeedProfile({
      user_id: userId,
      headline: headline.trim(),
      about: about.trim(),
      avatar_url: profile?.avatar_url || null,
      banner_url: profile?.banner_url || null,
      website_url: profile?.website_url || null,
      feed_topics: topics,
      looking_for: lookingFor,
      setup_completed: true,
    });
    setSaving(false);
    onSaved(saved);
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm grid place-items-center p-3">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-elegant p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold">Ֆիդի պրոֆիլ</h2>
            <p className="text-sm text-muted-foreground">
              Սա քո համայնքային այցեքարտն է՝ LinkedIn-ի ոճով։
            </p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-secondary">
            ×
          </button>
        </div>
        <div className="space-y-4 mt-5">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Վերնագիր</span>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1 w-full min-h-[44px] px-3 rounded-xl border border-input bg-background"
              placeholder="օր.՝ Frontend learner · Robotics fan"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Մասին</span>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-input bg-background"
              placeholder="Ի՞նչ ես սովորում, ինչ նախագծեր ես ուզում անել…"
            />
          </label>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Թեմաներ</div>
            <div className="flex flex-wrap gap-2">
              {ALL_INTERESTS.map((topic) => (
                <button
                  type="button"
                  key={topic}
                  onClick={() => toggle(topic, setTopics, topics)}
                  className={`min-h-[40px] px-3 rounded-full text-sm border ${topics.includes(topic) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Փնտրում եմ</div>
            <div className="flex flex-wrap gap-2">
              {[
                "մենթոր",
                "թիմակիցներ",
                "պրակտիկա",
                "կամավորություն",
                "նախագծեր",
                "միջոցառումներ",
              ].map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => toggle(item, setLookingFor, lookingFor)}
                  className={`min-h-[40px] px-3 rounded-full text-sm border ${lookingFor.includes(item) ? "bg-foreground text-background border-foreground" : "bg-background border-border"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border">
            Չեղարկել
          </button>
          <button
            onClick={save}
            disabled={saving || headline.trim().length < 3 || topics.length < 1}
            className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Պահպանել"}
          </button>
        </div>
      </div>
    </div>
  );
}
