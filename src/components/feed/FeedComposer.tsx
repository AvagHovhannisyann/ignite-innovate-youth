import { useEffect, useRef, useState } from "react";
import {
  createPost,
  uploadMedia,
  signMedia,
  removeMediaFiles,
  MAX_POST_MEDIA_FILES,
} from "@/lib/feed";
import { burstConfetti } from "@/lib/confetti";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { ImagePlus, Loader2, MapPin, Tag, X, Video, Send, Sparkles, PenLine } from "lucide-react";
import { dailyPrompt } from "@/lib/feed-prompts";

export function FeedComposer({
  userId,
  displayName,
  prefill,
  onPosted,
}: {
  userId: string;
  displayName: string;
  prefill?: string | null;
  onPosted: () => void;
}) {
  const [open, setOpen] = useState(!!prefill);
  const [content, setContent] = useState(prefill ? prefill + "\n\n" : "");
  const [tagsInput, setTagsInput] = useState("");
  const [location, setLocation] = useState("");
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [mediaTypes, setMediaTypes] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const draftUploads = useRef(new Set<string>());

  useEffect(
    () => () => {
      const abandoned = Array.from(draftUploads.current);
      if (abandoned.length) {
        void removeMediaFiles(abandoned).catch((cleanupError: unknown) =>
          console.error("Could not clean up abandoned feed draft", cleanupError),
        );
      }
    },
    [],
  );

  const initial = (displayName || "U").slice(0, 1).toUpperCase();

  function expand() {
    setOpen(true);
    setTimeout(() => areaRef.current?.focus(), 60);
  }

  function reset() {
    setOpen(false);
    setContent("");
    setTagsInput("");
    setLocation("");
    setMediaPaths([]);
    setMediaTypes([]);
    setPreviews([]);
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (mediaPaths.length + files.length > MAX_POST_MEDIA_FILES) {
      toast.error(`Կարելի է կցել առավելագույնը ${MAX_POST_MEDIA_FILES} մեդիա ֆայլ։`);
      e.target.value = "";
      return;
    }
    setUploading(true);
    const uploaded: { path: string; type: string }[] = [];
    try {
      for (const file of files) uploaded.push(await uploadMedia(userId, file));
      const paths = uploaded.map((u) => u.path);
      paths.forEach((path) => draftUploads.current.add(path));
      const signed = await signMedia(paths);
      setMediaPaths((p) => [...p, ...paths]);
      setMediaTypes((t) => [...t, ...uploaded.map((u) => u.type)]);
      setPreviews((p) => [...p, ...signed]);
    } catch (error: unknown) {
      try {
        await removeMediaFiles(uploaded.map((item) => item.path));
      } catch (cleanupError: unknown) {
        console.error("Could not clean up interrupted post upload", cleanupError);
      }
      toast.error(getErrorMessage(error, "Չհաջողվեց վերբեռնել ֆայլը"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeMedia(i: number) {
    const path = mediaPaths[i];
    if (path) draftUploads.current.delete(path);
    setMediaPaths((p) => p.filter((_, idx) => idx !== i));
    setMediaTypes((t) => t.filter((_, idx) => idx !== i));
    setPreviews((p) => p.filter((_, idx) => idx !== i));
    try {
      await removeMediaFiles(path ? [path] : []);
    } catch (error: unknown) {
      console.error("Could not remove discarded post media", error);
    }
  }

  async function cancel() {
    try {
      await removeMediaFiles(mediaPaths);
      mediaPaths.forEach((path) => draftUploads.current.delete(path));
    } catch (error: unknown) {
      console.error("Could not remove cancelled post media", error);
    }
    reset();
  }

  async function submit() {
    if (submitting || uploading) return;
    if (!content.trim() && !mediaPaths.length) {
      toast.error("Գրիր ինչ-որ բան կամ ավելացրու նկար։");
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 10);
      await createPost({
        author_id: userId,
        title: null,
        content: content.trim(),
        media_urls: mediaPaths,
        media_types: mediaTypes,
        tags,
        location: location.trim() || null,
      });
      burstConfetti(window.innerWidth / 2, 200, 28);
      toast.success("Ուղարկված է։ Կհայտնվի ֆիդում հաստատվելուց հետո։");
      draftUploads.current.clear();
      reset();
      onPosted();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց ուղարկել"));
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring min-h-[44px]";

  if (!open) {
    return (
      <button
        onClick={expand}
        className="w-full card-base rounded-2xl p-3 sm:p-4 flex items-center gap-3 text-left hover:border-primary/40 transition-colors group"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-semibold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="px-4 py-2.5 rounded-full border border-border bg-secondary/50 text-sm text-muted-foreground truncate group-hover:bg-secondary transition-colors">
            {dailyPrompt()}
          </div>
        </div>
        <PenLine className="w-4 h-4 text-muted-foreground shrink-0 hidden min-[380px]:block" />
      </button>
    );
  }

  return (
    <div className="card-base rounded-2xl p-3 sm:p-4 space-y-3 animate-rise">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground font-semibold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            ref={areaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={dailyPrompt()}
            aria-label="Գրառման բովանդակություն"
            className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[72px]"
          />
        </div>
        <button
          onClick={() => void cancel()}
          aria-label="Փակել"
          className="shrink-0 w-11 h-11 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square bg-secondary rounded-xl overflow-hidden">
              {mediaTypes[i] === "video" ? (
                <video
                  src={src}
                  aria-label={`Կցված տեսանյութ ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img src={src} alt={`Կցված նկար ${i + 1}`} className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => void removeMedia(i)}
                aria-label={`Հեռացնել կցված ֆայլ ${i + 1}`}
                className="absolute top-1 right-1 w-11 h-11 rounded-full bg-background/90 grid place-items-center shadow-soft"
              >
                <X className="w-4 h-4" />
              </button>
              {mediaTypes[i] === "video" && (
                <Video className="absolute bottom-1.5 left-1.5 w-4 h-4 text-white drop-shadow" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid min-[480px]:grid-cols-2 gap-2">
        <div className="relative">
          <Tag className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="Թեգեր՝ ստորակետով"
            aria-label="Գրառման թեգեր"
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="relative">
          <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Վայր (ոչ պարտադիր)"
            aria-label="Գրառման վայր"
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1">
          <label
            aria-label="Կցել մեդիա"
            className={`inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg hover:bg-secondary text-sm text-muted-foreground cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            <span className="hidden min-[420px]:inline">Մեդիա</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={onFiles}
            />
          </label>
          <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" /> Հրապարակվում է ադմինի հաստատումից հետո
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {content.length}/4000
          </span>
          <button
            onClick={submit}
            disabled={submitting || uploading || (!content.trim() && !mediaPaths.length)}
            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Կիսվել
          </button>
        </div>
      </div>
    </div>
  );
}
