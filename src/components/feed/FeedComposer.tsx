import { useRef, useState } from "react";
import { createPost, uploadMedia, signMedia } from "@/lib/feed";
import { burstConfetti } from "@/lib/confetti";
import { toast } from "sonner";
import {
  ImagePlus, Loader2, MapPin, Tag, X, Video, Send, Sparkles, PenLine,
} from "lucide-react";

/** Rotating conversation starters — one per day, so the box never feels stale. */
const PROMPTS = [
  "Ի՞նչ սովորեցիր այս շաբաթ, որով հպարտ ես։",
  "Ցույց տուր նախագծիդ ընթացքը՝ մեկ նկարով։",
  "Ի՞նչ գաղափար ունես, որին թիմակիցներ են պետք։",
  "Խորհուրդ տուր նոր միացած ուսանողին։",
  "Ո՞ր հմտությունն ես հիմա սովորում և ինչու։",
  "Կիսվիր այս շաբաթվա փոքր հաղթանակով 🏆",
  "Ի՞նչ միջոցառման ես պատրաստվում մասնակցել։",
];

export function dailyPrompt(offset = 0) {
  const day = Math.floor(Date.now() / 86400000);
  return PROMPTS[(day + offset) % PROMPTS.length];
}

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
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadMedia(userId, f)));
      const paths = uploaded.map((u) => u.path);
      const signed = await signMedia(paths);
      setMediaPaths((p) => [...p, ...paths]);
      setMediaTypes((t) => [...t, ...uploaded.map((u) => u.type)]);
      setPreviews((p) => [...p, ...signed]);
    } catch (err: any) {
      toast.error(err?.message || "Չհաջողվեց վերբեռնել ֆայլը");
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
      toast.success("Ուղարկված է ✨ Կհայտնվի ֆիդում հաստատվելուց հետո։");
      reset();
      onPosted();
    } catch (err: any) {
      toast.error(err?.message || "Չհաջողվեց ուղարկել");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-ring min-h-[40px]";

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
            className="w-full bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[72px]"
          />
        </div>
        <button
          onClick={reset}
          aria-label="Փակել"
          className="shrink-0 w-8 h-8 grid place-items-center rounded-lg hover:bg-secondary text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square bg-secondary rounded-xl overflow-hidden">
              {mediaTypes[i] === "video" ? (
                <video src={src} className="w-full h-full object-cover" />
              ) : (
                <img src={src} alt="" className="w-full h-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => removeMedia(i)}
                aria-label="Հեռացնել"
                className="absolute top-1 right-1 w-8 h-8 rounded-full bg-background/90 grid place-items-center shadow-soft"
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
            className={`${inputCls} pl-9`}
          />
        </div>
        <div className="relative">
          <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Վայր (ոչ պարտադիր)"
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1">
          <label
            className={`inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg hover:bg-secondary text-sm text-muted-foreground cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : ""}`}
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            <span className="hidden min-[420px]:inline">Մեդիա</span>
            <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={onFiles} />
          </label>
          <span className="text-[11px] text-muted-foreground hidden sm:inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" /> Հրապարակվում է ադմինի հաստատումից հետո
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground tabular-nums">{content.length}/4000</span>
          <button
            onClick={submit}
            disabled={submitting || uploading || (!content.trim() && !mediaPaths.length)}
            className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Կիսվել
          </button>
        </div>
      </div>
    </div>
  );
}
