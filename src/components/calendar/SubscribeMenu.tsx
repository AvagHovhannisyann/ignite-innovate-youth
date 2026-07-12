import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarDays,
  Calendar,
  Mail,
  Copy,
  Check,
  ExternalLink,
  QrCode,
} from "lucide-react";

/**
 * One-click calendar subscription. The ICS feed is read-only and keeps the
 * external calendar in sync automatically.
 */
export function SubscribeMenu({ httpsUrl }: { httpsUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qr, setQr] = useState("");

  const webcal = httpsUrl.replace(/^https?:\/\//, "webcal://");

  // Lazy-generate the QR only when opened — keeps `qrcode` out of the main bundle.
  useEffect(() => {
    if (!showQr || qr || !httpsUrl) return;
    import("qrcode").then((QR) =>
      QR.toDataURL(webcal, { width: 220, margin: 1 })
        .then(setQr)
        .catch(() => {}),
    );
  }, [showQr, qr, webcal, httpsUrl]);

  if (!httpsUrl) return null;
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
    httpsUrl,
  )}&name=${encodeURIComponent("Երիտասարդական Տուն")}`;

  const item =
    "flex items-center gap-2.5 w-full px-2.5 min-h-[44px] rounded-lg hover:bg-secondary text-sm text-left";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-secondary px-3 text-sm hover:bg-secondary/70">
          <CalendarCheck className="w-4 h-4" />
          <span className="hidden sm:inline">Բաժանորդագրվել</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <div className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Համաժամեցրու քո օրացույցի հավելվածի հետ (միակողմանի, ավտոմատ թարմացվող)։
        </div>
        <a href={google} target="_blank" rel="noopener noreferrer" className={item}>
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" /> Google Calendar
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
        </a>
        <a href={webcal} className={item}>
          <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" /> Apple Calendar
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
        </a>
        <a href={outlook} target="_blank" rel="noopener noreferrer" className={item}>
          <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /> Outlook
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
        </a>
        <button
          className={item}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(httpsUrl);
              setCopied(true);
              toast.success("Հղումը պատճենվեց");
              setTimeout(() => setCopied(false), 2000);
            } catch {
              toast.error("Հղումը չհաջողվեց պատճենել");
            }
          }}
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          Պատճենել հղումը
        </button>
        <button className={item} onClick={() => setShowQr((v) => !v)}>
          <QrCode className="w-4 h-4" /> QR՝ հեռախոսի համար
        </button>
        {showQr && (
          <div className="p-2 grid place-items-center">
            {qr ? (
              <img
                src={qr}
                alt="Օրացույցի բաժանորդագրության QR"
                className="rounded-lg border border-border bg-white p-1 w-[180px] h-[180px]"
              />
            ) : (
              <div className="w-[180px] h-[180px] rounded-lg bg-secondary animate-pulse" />
            )}
            <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
              Սկանավորիր հեռախոսով՝ օրացույցին բաժանորդագրվելու համար
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
