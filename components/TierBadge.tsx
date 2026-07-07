import { Tier } from "@/lib/types";
import { TIER_RULES } from "@/lib/tier";

const DOT_COLOR: Record<Tier, string> = {
  정상: "bg-emerald-500",
  주의: "bg-yellow-500",
  경고: "bg-orange-500",
  위험: "bg-red-500",
  매우위험: "bg-white",
};

// 매우위험 위젯(뱃지)은 카드 안내문에 쓰이는 옅은 톤(TIER_RULES)과 달리
// 배경 전체를 붉게 채워 한눈에 띄도록 하고, 대비가 확보되는 흰 글씨를 쓴다.
const BADGE_STYLE_OVERRIDE: Partial<Record<Tier, { bg: string; color: string; ring: string }>> = {
  매우위험: { bg: "bg-[#FF0000]", color: "text-white", ring: "ring-red-800" },
};

export default function TierBadge({
  tier,
  size = "md",
}: {
  tier: Tier;
  size?: "sm" | "md" | "lg";
}) {
  const rule = TIER_RULES[tier];
  const style = BADGE_STYLE_OVERRIDE[tier] ?? rule;
  const sizeClasses =
    size === "lg"
      ? "text-base px-4 py-2 gap-2"
      : size === "sm"
      ? "text-xs px-2 py-1 gap-1"
      : "text-sm px-3 py-1.5 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${style.bg} ${style.color} ${sizeClasses} ring-1 ring-inset ${style.ring}`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${DOT_COLOR[tier]} ${
          tier === "매우위험" || tier === "위험" ? "animate-pulse-ring" : ""
        }`}
      />
      {rule.label}
    </span>
  );
}
