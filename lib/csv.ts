import { LogEntry } from "./types";

const EVENT_LABEL: Record<string, string> = {
  WORK_START: "작업 시작",
  WORK_END: "작업 종료",
  REST_START: "휴식 시작",
  REST_END: "휴식 종료",
  OVERDUE: "휴식 초과",
  TIER_UP: "단계 상승",
  ILLNESS_REPORTED: "온열질환 의심 신고",
  TEMP_RECORDED: "체감온도 기록",
};

export function logsToCsv(logs: LogEntry[]): string {
  const header = ["일자", "시각", "작업자", "체감온도", "등급", "이벤트", "의심 온열질환"];
  const rows = logs.map((log) => {
    const date = new Date(log.timestamp);
    const dateStr = date.toLocaleDateString("ko-KR");
    const timeStr = date.toLocaleTimeString("ko-KR");
    return [
      dateStr,
      timeStr,
      log.worker_name,
      log.site_temp != null ? `${log.site_temp}℃` : "",
      log.tier ?? "",
      EVENT_LABEL[log.event_type] ?? log.event_type,
      log.note ?? "",
    ];
  });

  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header, ...rows].map((r) => r.map(escape).join(","));
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
