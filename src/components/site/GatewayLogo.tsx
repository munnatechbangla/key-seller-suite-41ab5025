import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";

export function GatewayLogo({ src, alt = "", className = "h-6 w-6 shrink-0 object-contain" }: { src?: string | null; alt?: string; className?: string }) {
  const [url, setUrl] = useState<string>(() => (src && !src.startsWith("media://") ? src : ""));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (!src) { setUrl(""); return; }
    if (src.startsWith("media://")) {
      setUrl("");
      resolveStoredUrlAsync(src).then((u) => { if (!cancelled) setUrl(u); }).catch(() => { if (!cancelled) setUrl(""); });
    } else {
      setUrl(src);
    }
    return () => { cancelled = true; };
  }, [src]);

  if (!url || failed) return <Wallet className="h-5 w-5 shrink-0 text-primary" />;
  return <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />;
}
