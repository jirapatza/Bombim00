import { assessFreshness } from "../utils/freshness";

interface Props {
  date?: string;
  drawDays?: string;
  now?: Date;
}

// Nothing is rendered while the source is keeping up: the badge only appears
// when a draw is overdue, so a quiet list stays quiet.
export function FreshnessBadge({ date, drawDays = "", now = new Date() }: Props) {
  const freshness = assessFreshness(date ?? "", drawDays, now);
  if (!freshness?.stale) return null;
  return (
    <span className="badge gold" title={`ผลล่าสุด ${date}`}>
      ต้นทางยังไม่ประกาศ • ล่าสุด {freshness.label}
    </span>
  );
}
