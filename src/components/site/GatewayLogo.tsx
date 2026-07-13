import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { resolveStoredUrlAsync } from "@/lib/media/resolve";

export function GatewayLogo({
  src,
  alt = "",
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
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

  // Consistent sizing: mobile 48x48, desktop 56x56. Never stretch.
  const boxClass = "shrink-0 h-12 w-12 md:h-14 md:w-14 rounded-lg bg-muted/40 border flex items-center justify-center overflow-hidden";

  if (!url || failed) {
    return (
      <div className={className ?? boxClass}>
        <Wallet className="h-5 w-5 text-primary" />
      </div>
    );
  }
  return (
    <div className={className ?? boxClass}>
      <img
        src={url}
        alt={alt}
        className="h-full w-full object-contain p-1.5"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
