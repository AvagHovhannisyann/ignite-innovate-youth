import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { CalendarCheck, Copy, Check, ExternalLink } from "lucide-react";

/**
 * One-click calendar subscription. The ICS feed is read-only and keeps the
 * external calendar in sync automatically.
 */
export function SubscribeMenu({ httpsUrl }: { httpsUrl: string }) {
  const [copied, setCopied] = useState(false);
  if (!httpsUrl) return null;

  const webcal = httpsUrl.replace(/^https?:\/\//, "webcal://");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(
    httpsUrl,
  )}&name=${encodeURIComponent("Երիտասարդական Տուն")}`;

  const item =
    "flex items-center gap-2.5 w-full px-2.5 min-h-[44px] rounded-lg hover:bg-secondary text-sm text-left";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg bg-secondary hover:bg-secondary/70 text-sm">
          <CalendarCheck className="w-4 h-4" />
          <span className="hidden sm:inline">Բաժանորդագրվել</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        <div className="px-2.5 py-1.5 text-[11px] text-muted-foreground">
          Համաժամեցրու քո օրացույցի հավելվածի հետ (միակողմանի, ավտոմատ թարմացվող)։
        </div>
        <a href={google} target="_blank" rel="noopener noreferrer" className={item}>
          <span className="text-base">📅</span> Google Calendar
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
        </a>
        <a href={webcal} className={item}>
          <span className="text-base"></span> Apple Calendar
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
        </a>
        <a href={outlook} target="_blank" rel="noopener noreferrer" className={item}>
          <span className="text-base">📧</span> Outlook
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
        </a>
        <button
          className={item}
          onClick={() => {
            navigator.clipboard.writeText(httpsUrl);
            setCopied(true);
            toast.success("Հղումը պատճենվեց");
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          Պատճենել հղումը
        </button>
      </PopoverContent>
    </Popover>
  );
}
