import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { createPost, updatePost, uploadMedia, signMedia } from "@/lib/feed";
import { ArrowLeft, ImagePlus, Loader2, MapPin, Tag, X, Video, Send } from "lucide-react";

const searchSchema = z.object({ edit: z.string().optional() });

export const Route = createFileRoute("/feed/create")({
  validateSearch: searchSchema,
  component: CreatePostPage,
});

function CreatePostPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { edit } = Route.useSearch();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [location, setLocation] = useState("");
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    if (!edit) return;
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("*")
        .eq("id", edit)
        .eq("author_id", user.id)
        .single();
      if (!data) {
        nav({ to: "/profile" });
        return;
      }
      setTitle(data.title || "");
      setContent(data.content || "");
      setTagsInput((data.tags || []).join(", "));
      setLocation(data.location || "");
      setMediaPaths(data.media_urls || []);
      setMediaTypes(data.media_types || []);
      setPreviews(await signMedia(data.media_urls || []));
    })();
  }, [user, loading, edit, nav]);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadMedia(user.id, f)));
      const newPaths = uploaded.map((u) => u.path);
      const newTypes = uploaded.map((u) => u.type);
      const signed = await signMedia(newPaths);
      setMediaPaths((p) => [...p, ...newPaths]);
      setMediaTypes((t) => [...t, ...newTypes]);
      setPreviews((p) => [...p, ...signed]);
    } catch (err: any) {
      setError(err.message || "Չհաջողվեց վերբեռնել ֆայլը");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeMedia(i: number) {
    setMediaPaths((p) => p.filter((_, idx) => idx !== i));
    setMediaTypes((t) => t.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    if (!content.trim() && mediaPaths.length === 0) {
      setError("Գրիր ինչ-որ բան կամ ավելացրու մեդիա։");
      return;
    }
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 10);
    setSubmitting(true);
    try {
      if (edit) {
        await updatePost(edit, {
          title: title.trim() || null,
          content: content.trim(),
          media_urls: mediaPaths,
          media_types: mediaTypes,
          tags,
          location: location.trim() || null,
        });
      } else {
        await createPost({
          author_id: user.id,
          title: title.trim() || null,
          content: content.trim(),
          media_urls: mediaPaths,
          media_types: mediaTypes,
          tags,
          location: location.trim() || null,
        });
      }
      nav({ to: "/profile", search: { tab: "posts" } as any });
    } catch (err: any) {
      setError(err.message || "Չհաջողվեց ուղարկել գրառումը");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-2xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-5 sm:py-8 pb-32 md:pb-8">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Վերադառնալ
        </Link>

        <header className="mb-5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold break-words">
            {edit ? "Խմբագրել գրառումը" : "Նոր գրառում"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 break-words">
            Քո գրառումն ուղարկվում է ադմինի վերանայման։ Հաստատվելուց հետո այն կտեսնեն բոլորը։
          </p>
        </header>

        <form onSubmit={submit} className="space-y-4 card-base rounded-2xl p-4 sm:p-6">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Վերնագիր (ոչ պարտադիր)
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-sm min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Տեքստ</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Կիսվիր քո մտքով…"
              className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-sm"
            />
            <div className="text-[11px] text-muted-foreground mt-1 text-right">
              {content.length}/4000
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Մեդիա (նկար/վիդեո)
            </label>
            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-2">
                {previews.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square bg-secondary rounded-lg overflow-hidden"
                  >
                    {mediaTypes[i] === "video" ? (
                      <video src={src} className="w-full h-full object-cover" />
                    ) : (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      aria-label="Հեռացնել"
                      className="absolute top-1 right-1 w-9 h-9 rounded-full bg-background/90 text-foreground grid place-items-center shadow-soft"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {mediaTypes[i] === "video" && (
                      <Video className="absolute bottom-1 left-1 w-4 h-4 text-white drop-shadow" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <label
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-border text-sm cursor-pointer hover:bg-secondary min-h-[44px] ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              <span>Ավելացնել ֆայլեր</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={onFiles}
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Թեգեր (ստորակետով)
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="երաժշտություն, արվեստ"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm min-h-[44px]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Վայր (ոչ պարտադիր)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Էջմիածին"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm min-h-[44px]"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3 break-words">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground break-words min-w-0">
              Կարգավիճակ՝ Սպասում է վերանայման
            </p>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 min-h-[44px]"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {edit ? "Թարմացնել" : "Ուղարկել ադմինի հաստատման"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
