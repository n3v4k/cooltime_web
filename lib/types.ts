export type Tier = "정상" | "주의" | "경고" | "위험" | "매우위험";

export type RestStatus = "working" | "resting" | "overdue" | "off";

// 관리자가 수동으로 선택하는 휴식 주기 정책
export type RestPolicy = "2h20m" | "1h15m" | "1m1m";

export type IllnessType = "열사병" | "열탈진" | "열경련" | "열실신" | "열부종" | null;

export type EventType =
  | "WORK_START"
  | "WORK_END"
  | "REST_START"
  | "REST_END"
  | "OVERDUE"
  | "TIER_UP"
  | "ILLNESS_REPORTED"
  | "TEMP_RECORDED";

export type TempSource = "auto" | "manual";

export interface Site {
  id: string;
  join_code: string;
  name: string | null;
  temp: number | null;
  humidity: number | null;
  feels_like_temp: number | null;
  tier: Tier | null;
  temp_source: TempSource;
  rest_policy: RestPolicy;
  created_at: string;
}

export interface Worker {
  id: string;
  site_id: string;
  name: string;
  is_outdoor: boolean;
  tier_entered_at: string | null;
  rest_status: RestStatus;
  rest_started_at: string | null;
  updated_at: string;
}

export interface LogEntry {
  id: string;
  site_id: string;
  worker_name: string;
  timestamp: string;
  site_temp: number | null;
  tier: Tier | null;
  event_type: EventType;
  note: string | null;
}
