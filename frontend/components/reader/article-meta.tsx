import { Clock3, ExternalLink, UserRound } from "lucide-react";

import { formatDate, formatEditionLength, hostname } from "@/lib/utils";
import type { AnalysisResult } from "@/types/api";

export function ArticleMeta({
  result,
  light = false,
}: {
  result: AnalysisResult;
  light?: boolean;
}) {
  const tone = light ? "text-white/60" : "text-ink-muted";
  const strong = light ? "text-white/85" : "text-ink-soft";

  return (
    <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${tone}`}>
      {result.author && (
        <span className={`inline-flex items-center gap-1.5 ${strong}`}>
          <UserRound className="size-3.5" /> {result.author}
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <Clock3 className="size-3.5" /> {formatEditionLength(result)}
      </span>
      <span>{formatDate(result.published_at)}</span>
      <a
        href={result.source_url}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-1 transition-colors hover:text-accent"
      >
        {hostname(result.source_url)} <ExternalLink className="size-3" />
      </a>
    </div>
  );
}
