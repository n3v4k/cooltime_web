import { RestPolicy, Tier } from "./types";

export const TIER_ORDER: Tier[] = ["정상", "주의", "경고", "위험", "매우위험"];

export interface TierRule {
  tier: Tier;
  color: string;
  bg: string;
  ring: string;
  label: string;
  workIntervalMin: number | null; // 이 시간마다
  restDurationMin: number | null; // 이만큼 휴식
  legal: "법적 의무" | "권고" | "강력 권고" | "-";
  description: string;
  outdoorNote?: string;
}

export const TIER_RULES: Record<Tier, TierRule> = {
  정상: {
    tier: "정상",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-400",
    label: "정상",
    workIntervalMin: null,
    restDurationMin: null,
    legal: "-",
    description: "체감온도 31℃ 미만입니다. 특별한 조치가 필요하지 않아요.",
  },
  주의: {
    tier: "주의",
    color: "text-yellow-700",
    bg: "bg-yellow-50",
    ring: "ring-yellow-400",
    label: "주의",
    workIntervalMin: 120,
    restDurationMin: 20,
    legal: "법적 의무",
    description:
      "2시간 연속 작업 시 냉방·시간조정·휴식 중 1개 이상의 조치가 필요합니다.",
  },
  경고: {
    tier: "경고",
    color: "text-orange-600",
    bg: "bg-orange-50",
    ring: "ring-orange-400",
    label: "경고",
    workIntervalMin: 120,
    restDurationMin: 20,
    legal: "법적 의무",
    description: "2시간마다 20분 휴식이 법적으로 의무화됩니다.",
  },
  위험: {
    tier: "위험",
    color: "text-red-600",
    bg: "bg-red-50",
    ring: "ring-red-400",
    label: "위험",
    workIntervalMin: 60,
    restDurationMin: 15,
    legal: "권고",
    // 33℃ 이상부터 적용되는 법적 의무(2시간마다 20분)는 위험 단계에서도 사라지지 않는
    // 최소 기준이며, 여기에 더해 1시간마다 15분 휴식이 추가로 권고된다.
    description: "법적 의무: 2시간마다 20분 휴식 · 권고: 1시간마다 15분 휴식",
    outdoorNote: "오후 2~5시 옥외 작업은 중지가 권고됩니다.",
  },
  매우위험: {
    tier: "매우위험",
    color: "text-[#FF0000]",
    bg: "bg-red-50",
    ring: "ring-red-700",
    label: "매우위험",
    // 옥외 작업 전면중지는 권고 사항이며, 실내 작업 등 계속 작업하는 경우를 위해
    // 위험 단계의 필수 휴식 주기(1시간마다 15분)는 그대로 유지한다.
    workIntervalMin: 60,
    restDurationMin: 15,
    legal: "강력 권고",
    description: "법적 의무: 2시간마다 20분 휴식 · 권고: 1시간마다 15분 휴식",
    outdoorNote: "옥외 작업 전면 중지가 강력히 권고됩니다 (긴급조치 제외).",
  },
};

// 관리자가 수동으로 고를 수 있는 휴식 주기 정책
export const REST_POLICIES: Record<RestPolicy, { label: string; workIntervalMin: number; restDurationMin: number }> = {
  "2h20m": { label: "2시간마다 20분 휴식", workIntervalMin: 120, restDurationMin: 20 },
  "1h15m": { label: "1시간마다 15분 휴식", workIntervalMin: 60, restDurationMin: 15 },
};

// 체감온도 단계(정상 제외)에서는 관리자가 선택한 휴식 정책의 시간 수치를 그대로 적용하고,
// 색상·법적 근거·옥외 안내 등 단계별 성격은 TIER_RULES를 그대로 따른다.
export function getEffectiveRule(tier: Tier, policy: RestPolicy): TierRule {
  const base = TIER_RULES[tier];
  if (tier === "정상") return base;

  const { workIntervalMin, restDurationMin } = REST_POLICIES[policy];
  const workLabel = workIntervalMin % 60 === 0 ? `${workIntervalMin / 60}시간` : `${workIntervalMin}분`;
  const verb =
    base.legal === "법적 의무" ? "법적으로 의무화됩니다" : base.legal === "강력 권고" ? "강력히 권고됩니다" : "필요합니다";

  return {
    ...base,
    workIntervalMin,
    restDurationMin,
    description: `${workLabel}마다 ${restDurationMin}분 휴식이 ${verb}.`,
  };
}

export function getTier(feelsLike: number): Tier {
  if (feelsLike >= 38) return "매우위험";
  if (feelsLike >= 35) return "위험";
  if (feelsLike >= 33) return "경고";
  if (feelsLike >= 31) return "주의";
  return "정상";
}

export function isTierUp(prev: Tier | null, next: Tier): boolean {
  if (!prev) return true;
  return TIER_ORDER.indexOf(next) > TIER_ORDER.indexOf(prev);
}

export function isOutdoorRestrictedNow(tier: Tier, isOutdoor: boolean): boolean {
  if (!isOutdoor) return false;
  const hour = new Date().getHours();
  const inAfternoonWindow = hour >= 14 && hour < 17;
  if (tier === "매우위험") return true;
  if (tier === "위험" && inAfternoonWindow) return true;
  return false;
}
