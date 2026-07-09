"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { LogEntry, Site, TempSource, Tier, Worker } from "@/lib/types";
import { getEffectiveRule, getTier, isRestNeeded, REST_POLICIES, TIER_RULES } from "@/lib/tier";
import { getSummerWindChill } from "@/lib/heatIndex";
import { downloadCsv, logsToCsv } from "@/lib/csv";
import { formatElapsed } from "@/lib/time";
import { requestNotificationPermission, notify } from "@/lib/notify";
import TierBadge from "./TierBadge";
import LegalAccordion from "./LegalAccordion";
import IllnessGuideList, { IllnessFocusRequest } from "./IllnessGuideList";
import InfoPopover from "./InfoPopover";
import { AdminSite } from "./AdminSiteForm";

const POLL_MS = 7000;

export default function AdminDashboard({
  site,
  onExit,
}: {
  site: AdminSite;
  onExit: () => void;
}) {
  const [siteRow, setSiteRow] = useState<Site | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [newName, setNewName] = useState("");
  const [tempSource, setTempSource] = useState<TempSource>("manual");
  const [temp, setTemp] = useState(31);
  const [humidity, setHumidity] = useState(60);
  const [autoNotice, setAutoNotice] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const dismissedLogsKey = `cooltime_admin_dismissed_logs_${site.siteId}`;
  const [dismissedLogIds, setDismissedLogIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(dismissedLogsKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [dismissedOverdueIds, setDismissedOverdueIds] = useState<Set<string>>(new Set());
  const [illnessFocus, setIllnessFocus] = useState<IllnessFocusRequest | null>(null);
  const initializedWeatherRef = useRef(false);
  const initializedIllnessRef = useRef(false);
  const notifiedIllnessIdsRef = useRef<Set<string>>(new Set());
  const illnessFocusTokenRef = useRef(0);

  function focusIllnessGuide(type: string | null) {
    if (!type) return;
    illnessFocusTokenRef.current += 1;
    setIllnessFocus({ type, token: illnessFocusTokenRef.current });
  }

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const fetchSite = useCallback(async () => {
    const { data } = await supabase.from("sites").select("*").eq("id", site.siteId).maybeSingle();
    if (data) setSiteRow(data as Site);
  }, [site.siteId]);

  const fetchWorkers = useCallback(async () => {
    const { data } = await supabase
      .from("workers")
      .select("*")
      .eq("site_id", site.siteId)
      .order("updated_at", { ascending: false });
    if (data) setWorkers(data as Worker[]);
  }, [site.siteId]);

  const fetchLogs = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("logs")
      .select("*")
      .eq("site_id", site.siteId)
      .gte("timestamp", startOfDay.toISOString())
      .order("timestamp", { ascending: false });
    if (!data) return;
    setLogs(data as LogEntry[]);

    // 자가진단 위험 신고를 웹 알림으로 전송 (최초 로드 시 기존 기록은 알림 없이 기준선으로만 등록)
    const illnessLogs = (data as LogEntry[]).filter((l) => l.event_type === "ILLNESS_REPORTED");
    if (!initializedIllnessRef.current) {
      illnessLogs.forEach((l) => notifiedIllnessIdsRef.current.add(l.id));
      initializedIllnessRef.current = true;
      return;
    }
    illnessLogs.forEach((l) => {
      if (notifiedIllnessIdsRef.current.has(l.id)) return;
      notifiedIllnessIdsRef.current.add(l.id);
      if (l.note === "열사병") {
        notify("긴급: 열사병 의심 신고", {
          body: `${l.worker_name} 님 - 즉시 확인하고 119 신고 여부를 확인하세요.`,
        });
      } else {
        notify("온열질환 의심 신고", {
          body: `${l.worker_name} 님 - ${l.note ?? "증상"} 의심 · 확인이 필요합니다.`,
        });
      }
    });
  }, [site.siteId]);

  useEffect(() => {
    fetchSite();
    fetchWorkers();
    fetchLogs();
    const poll = setInterval(() => {
      fetchSite();
      fetchWorkers();
      fetchLogs();
    }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [fetchSite, fetchWorkers, fetchLogs]);

  // 기온·습도로 체감온도를 계산해 저장한다 (휴식 타이머는 이 체감온도 기준으로 동작)
  // 산업안전보건기준에 관한 규칙상 체감온도·조치사항은 기록해 당해연도 말까지 보관해야 하므로,
  // 측정할 때마다 logs에도 기록을 남긴다.
  const applyReading = useCallback(
    async (t: number, rh: number, source: TempSource) => {
      const feelsLike = getSummerWindChill(t, rh);
      const nextTier: Tier = getTier(feelsLike);
      await supabase
        .from("sites")
        .update({ temp: t, humidity: rh, feels_like_temp: feelsLike, tier: nextTier, temp_source: source })
        .eq("id", site.siteId);
      await supabase.from("logs").insert({
        site_id: site.siteId,
        worker_name: `현장_${site.name}`,
        site_temp: feelsLike,
        tier: nextTier,
        event_type: "TEMP_RECORDED",
        note: `기온 ${t}℃ · 습도 ${rh}% (${source === "auto" ? "자동" : "수동"}) · ${TIER_RULES[nextTier].description}`,
      });
      fetchSite();
    },
    [site.siteId, fetchSite]
  );

  // 위치 기반 자동 조회 (실패 시 수동 입력으로 전환)
  const fetchAutoWeather = useCallback(() => {
    if (!navigator.geolocation) {
      setAutoNotice("이 브라우저는 위치 정보를 지원하지 않아 수동 입력으로 전환합니다.");
      setTempSource("manual");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/weather?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const data = await res.json();
          if (data.fallback || data.temp == null || data.humidity == null) {
            setAutoNotice("날씨 정보를 가져올 수 없어 수동 입력으로 전환합니다.");
            setTempSource("manual");
            return;
          }
          setLocationName(data.locationName ?? null);
          setTemp(data.temp);
          setHumidity(data.humidity);
          setAutoNotice(null);
          await applyReading(data.temp, data.humidity, "auto");
        } catch {
          setAutoNotice("날씨 정보를 가져올 수 없어 수동 입력으로 전환합니다.");
          setTempSource("manual");
        }
      },
      () => {
        setAutoNotice("위치 권한이 없어 수동 입력으로 전환합니다.");
        setTempSource("manual");
      },
      { timeout: 8000 }
    );
  }, [applyReading]);

  // 최초 로드 시 저장된 값으로 동기화한다. 이전에 수동으로 설정해뒀다면 그 값을 그대로
  // 복원하고, 자동 모드였다면(또는 아직 기록이 없다면) 새로 조회한다.
  useEffect(() => {
    if (!siteRow || initializedWeatherRef.current) return;
    initializedWeatherRef.current = true;

    if (siteRow.temp_source === "manual") {
      setTempSource("manual");
      if (siteRow.temp != null) setTemp(siteRow.temp);
      if (siteRow.humidity != null) setHumidity(siteRow.humidity);
    } else {
      setTempSource("auto");
      fetchAutoWeather();
    }
  }, [siteRow, fetchAutoWeather]);

  // 자동 모드일 때 5분마다 재조회
  useEffect(() => {
    if (tempSource !== "auto") return;
    const id = setInterval(fetchAutoWeather, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [tempSource, fetchAutoWeather]);

  // 더 이상 초과 상태가 아닌 작업자는 '확인 해제' 목록에서 제거해, 다음 초과 때 다시 배너가 뜨도록 함
  useEffect(() => {
    setDismissedOverdueIds((prev) => {
      const stillOverdueIds = new Set(
        workers.filter((w) => w.rest_status === "overdue").map((w) => w.id)
      );
      const next = new Set([...prev].filter((id) => stillOverdueIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [workers]);

  function handleSelectAuto() {
    setTempSource("auto");
    setAutoNotice(null);
    fetchAutoWeather();
  }

  function handleSelectManual() {
    setTempSource("manual");
  }

  function handleCommitManualReading() {
    applyReading(temp, humidity, "manual");
  }

  async function handleChangeRestPolicy(policy: keyof typeof REST_POLICIES) {
    await supabase.from("sites").update({ rest_policy: policy }).eq("id", site.siteId);
    fetchSite();
  }

  async function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await supabase.from("workers").insert({
      site_id: site.siteId,
      name: newName.trim(),
      is_outdoor: true,
      rest_status: "working",
      tier_entered_at: new Date().toISOString(),
    });
    setNewName("");
    fetchWorkers();
  }

  async function handleRestStartFor(worker: Worker) {
    await supabase
      .from("workers")
      .update({ rest_status: "resting", rest_started_at: new Date().toISOString() })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: site.siteId,
      worker_name: worker.name,
      site_temp: siteRow?.feels_like_temp ?? null,
      tier: siteRow?.tier ?? null,
      event_type: "REST_START",
      note: null,
    });
    fetchWorkers();
  }

  async function handleWorkResumeFor(worker: Worker) {
    await supabase
      .from("workers")
      .update({
        rest_status: "working",
        rest_started_at: null,
        tier_entered_at: new Date().toISOString(),
      })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: site.siteId,
      worker_name: worker.name,
      site_temp: siteRow?.feels_like_temp ?? null,
      tier: siteRow?.tier ?? null,
      event_type: "REST_END",
      note: null,
    });
    fetchWorkers();
  }

  async function handleWorkStartFor(worker: Worker) {
    await supabase
      .from("workers")
      .update({
        rest_status: "working",
        rest_started_at: null,
        tier_entered_at: new Date().toISOString(),
      })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: site.siteId,
      worker_name: worker.name,
      site_temp: siteRow?.feels_like_temp ?? null,
      tier: siteRow?.tier ?? null,
      event_type: "WORK_START",
      note: null,
    });
    fetchWorkers();
  }

  async function handleWorkEndFor(worker: Worker) {
    await supabase
      .from("workers")
      .update({ rest_status: "off", rest_started_at: null })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: site.siteId,
      worker_name: worker.name,
      site_temp: siteRow?.feels_like_temp ?? null,
      tier: siteRow?.tier ?? null,
      event_type: "WORK_END",
      note: null,
    });
    fetchWorkers();
  }

  // 일괄 액션은 해당 전환이 유효한 현재 상태의 작업자에게만 적용한다.
  // (예: 작업 종료 상태인 작업자는 "전체 휴식 시작"을 눌러도 그대로 유지)
  async function handleBulkRestStart() {
    const targets = workers.filter((w) => w.rest_status === "working");
    if (targets.length === 0) return;
    if (!window.confirm(`작업 중인 작업자 ${targets.length}명을 모두 휴식 상태로 전환할까요?`)) return;

    const startedAt = new Date().toISOString();
    await supabase
      .from("workers")
      .update({ rest_status: "resting", rest_started_at: startedAt })
      .eq("site_id", site.siteId)
      .eq("rest_status", "working");
    await supabase.from("logs").insert(
      targets.map((w) => ({
        site_id: site.siteId,
        worker_name: w.name,
        site_temp: siteRow?.feels_like_temp ?? null,
        tier: siteRow?.tier ?? null,
        event_type: "REST_START" as const,
        note: null,
      }))
    );
    fetchWorkers();
  }

  async function handleBulkWorkResume() {
    const targets = workers.filter((w) => w.rest_status === "resting" || w.rest_status === "overdue");
    if (targets.length === 0) return;
    if (!window.confirm(`휴식 중인 작업자 ${targets.length}명을 모두 작업 상태로 전환할까요?`)) return;

    await supabase
      .from("workers")
      .update({
        rest_status: "working",
        rest_started_at: null,
        tier_entered_at: new Date().toISOString(),
      })
      .eq("site_id", site.siteId)
      .in("rest_status", ["resting", "overdue"]);
    await supabase.from("logs").insert(
      targets.map((w) => ({
        site_id: site.siteId,
        worker_name: w.name,
        site_temp: siteRow?.feels_like_temp ?? null,
        tier: siteRow?.tier ?? null,
        event_type: "REST_END" as const,
        note: null,
      }))
    );
    fetchWorkers();
  }

  async function handleBulkWorkStart() {
    const targets = workers.filter((w) => w.rest_status === "off");
    if (targets.length === 0) return;
    if (!window.confirm(`작업 종료 상태인 작업자 ${targets.length}명을 모두 작업 시작 상태로 전환할까요?`)) return;

    await supabase
      .from("workers")
      .update({
        rest_status: "working",
        rest_started_at: null,
        tier_entered_at: new Date().toISOString(),
      })
      .eq("site_id", site.siteId)
      .eq("rest_status", "off");
    await supabase.from("logs").insert(
      targets.map((w) => ({
        site_id: site.siteId,
        worker_name: w.name,
        site_temp: siteRow?.feels_like_temp ?? null,
        tier: siteRow?.tier ?? null,
        event_type: "WORK_START" as const,
        note: null,
      }))
    );
    fetchWorkers();
  }

  async function handleBulkWorkEnd() {
    const targets = workers.filter((w) => w.rest_status !== "off");
    if (targets.length === 0) return;
    if (!window.confirm(`작업자 ${targets.length}명을 모두 작업 종료 상태로 전환할까요?`)) return;

    await supabase
      .from("workers")
      .update({ rest_status: "off", rest_started_at: null })
      .eq("site_id", site.siteId)
      .neq("rest_status", "off");
    await supabase.from("logs").insert(
      targets.map((w) => ({
        site_id: site.siteId,
        worker_name: w.name,
        site_temp: siteRow?.feels_like_temp ?? null,
        tier: siteRow?.tier ?? null,
        event_type: "WORK_END" as const,
        note: null,
      }))
    );
    fetchWorkers();
  }

  async function handleDeleteWorker(worker: Worker) {
    if (!window.confirm(`${worker.name} 님을 작업자 목록에서 삭제할까요? (오늘 기록은 유지됩니다)`)) {
      return;
    }
    await supabase.from("workers").delete().eq("id", worker.id);
    fetchWorkers();
  }

  function handleExportCsv() {
    const csv = logsToCsv(logs);
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCsv(`cooltime_${site.code}_${dateStr}.csv`, csv);
  }

  function handleExit() {
    localStorage.removeItem("cooltime_admin_site");
    onExit();
  }

  const tier: Tier = siteRow?.tier ?? "정상";
  const restPolicy = siteRow?.rest_policy ?? "2h20m";
  const rule = getEffectiveRule(tier, restPolicy);

  const workingCount = workers.filter((w) => w.rest_status === "working").length;
  const restingCount = workers.filter((w) => w.rest_status === "resting").length;
  const overdueCount = workers.filter((w) => w.rest_status === "overdue").length;

  // 최근 20분 이내 온열질환 의심 신고 (확인 처리된 항목은 제외)
  const urgentLogs = logs.filter(
    (l) =>
      l.event_type === "ILLNESS_REPORTED" &&
      Date.now() - new Date(l.timestamp).getTime() < 20 * 60 * 1000 &&
      !dismissedLogIds.has(l.id)
  );
  const heatstrokeUrgent = urgentLogs.filter((l) => l.note === "열사병");
  const otherUrgent = urgentLogs.filter((l) => l.note !== "열사병");
  const overdueWorkers = workers.filter(
    (w) => w.rest_status === "overdue" && !dismissedOverdueIds.has(w.id)
  );
  const restNeededWorkers = workers.filter((w) =>
    isRestNeeded(w.rest_status, w.tier_entered_at, rule.workIntervalMin, now)
  );

  function dismissLog(id: string) {
    setDismissedLogIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem(dismissedLogsKey, JSON.stringify([...next]));
      } catch {
        // 저장 실패는 무시 (기능에는 영향 없음)
      }
      return next;
    });
  }

  function dismissOverdue(id: string) {
    setDismissedOverdueIds((prev) => new Set(prev).add(id));
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-14">
      {/* 상단 정보 */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>🏗️ {site.name || "현장"}</span>
        <span className="flex items-center gap-1.5">
          코드 <span className="font-mono font-bold text-slate-700">{site.code}</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        </span>
      </div>

      {/* 긴급 배너: 열사병 */}
      {heatstrokeUrgent.map((log) => (
        <div
          key={log.id}
          className="animate-slide-up flex items-center justify-between gap-2 rounded-2xl bg-red-600 p-4 text-white shadow-2xl"
        >
          <p className="text-sm font-black">
            🚨 {log.worker_name} 님 열사병 의심 · 즉시 확인하세요
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="tel:119"
              className="rounded-full bg-white px-4 py-2 text-xs font-black text-red-600 transition-all hover:scale-105"
            >
              119 안내
            </a>
            <button
              onClick={() => {
                dismissLog(log.id);
                focusIllnessGuide(log.note);
              }}
              aria-label="알림 확인 완료"
              className="rounded-full bg-red-700/60 px-2.5 py-2 text-xs font-black text-white transition-all hover:scale-105 hover:bg-red-700"
            >
              ✓
            </button>
          </div>
        </div>
      ))}

      {/* 기타 온열질환 신고 */}
      {otherUrgent.map((log) => (
        <div
          key={log.id}
          className="animate-slide-up flex items-center justify-between gap-2 rounded-2xl bg-orange-100 p-4 text-sm font-bold text-orange-700 shadow-md"
        >
          <p>
            ⚠️ {log.worker_name} 님 {log.note} 의심 신고 · 상태를 확인하세요
          </p>
          <button
            onClick={() => {
              dismissLog(log.id);
              focusIllnessGuide(log.note);
            }}
            aria-label="알림 확인 완료"
            className="shrink-0 rounded-full bg-orange-200 px-2.5 py-1.5 text-xs font-black text-orange-700 transition-all hover:scale-105 hover:bg-orange-300"
          >
            ✓
          </button>
        </div>
      ))}

      {/* 휴식 초과 배너 */}
      {overdueWorkers.length > 0 && (
        <div className="animate-slide-up flex items-center justify-between gap-2 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 shadow-md ring-1 ring-red-200">
          <p>⏰ 휴식 초과: {overdueWorkers.map((w) => w.name).join(", ")}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => overdueWorkers.forEach((w) => handleWorkResumeFor(w))}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-black text-white transition-all hover:scale-105 hover:bg-red-700 active:scale-95"
            >
              작업 복귀
            </button>
            <button
              onClick={() => overdueWorkers.forEach((w) => dismissOverdue(w.id))}
              aria-label="알림 확인 완료"
              className="rounded-full bg-red-100 px-2.5 py-1.5 text-xs font-black text-red-600 transition-all hover:scale-105 hover:bg-red-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 휴식 필요 배너: 아직 초과는 아니지만 작업 주기를 넘겨 휴식이 필요한 작업자 */}
      {restNeededWorkers.length > 0 && (
        <div className="animate-pulse-ring flex items-center gap-2 rounded-2xl bg-orange-500 p-4 text-sm font-black text-white shadow-md">
          <p>휴식 필요: {restNeededWorkers.map((w) => w.name).join(", ")}</p>
        </div>
      )}

      {/* 온도 카드 */}
      <div className="animate-slide-up rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="mb-4 flex justify-center">
          <div className="flex overflow-hidden rounded-full border border-slate-200">
            <button
              onClick={handleSelectManual}
              className={`px-4 py-2 text-xs font-bold transition-all ${
                tempSource === "manual" ? "bg-sky-500 text-white" : "text-slate-400"
              }`}
            >
              수동 입력
            </button>
            <button
              onClick={handleSelectAuto}
              className={`px-4 py-2 text-xs font-bold transition-all ${
                tempSource === "auto" ? "bg-sky-500 text-white" : "text-slate-400"
              }`}
            >
              자동 (날씨 API)
            </button>
          </div>
        </div>

        <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400">
          <span>
            현장 공통 체감온도 {locationName && tempSource === "auto" ? `· ${locationName}` : ""}
          </span>
          <InfoPopover
            text={
              <>
                <p className="mb-2 font-bold text-slate-700">온도계 설치 및 기록 보관 의무</p>
                <ul className="list-disc space-y-1.5 pl-4">
                  <li>폭염작업이 예상되면 근로자의 주된 작업 장소에 온도계를 상시 비치해야 합니다.</li>
                  <li>체감온도와 조치사항을 기록해 해당 연도 12월 31일까지 보관해야 합니다.</li>
                  <li>
                    창고처럼 넓은 공간은 온도 편차가 커 온습도계 하나로는 부족하므로, 인력이
                    많이 배치되는 장소 인근에 설치하는 것이 권장됩니다.
                  </li>
                  <li>바닥에서 약 1.2~1.5m 높이에 설치하는 것이 실제 작업환경을 잘 반영합니다.</li>
                </ul>
              </>
            }
          />
        </div>
        <p className="mb-1 text-6xl font-black tracking-tighter text-slate-800">
          {siteRow?.feels_like_temp != null ? `${siteRow.feels_like_temp.toFixed(1)}°` : "-"}
        </p>
        <p className="mb-3 text-xs font-semibold text-slate-400">
          현재 온도 {siteRow?.temp != null ? `${siteRow.temp}℃` : "-"} · 습도{" "}
          {siteRow?.humidity != null ? `${siteRow.humidity}%` : "-"}
        </p>
        <TierBadge tier={tier} size="lg" />

        {autoNotice && tempSource === "manual" && (
          <p className="mt-3 text-xs font-semibold text-orange-500">{autoNotice}</p>
        )}

        {tempSource === "manual" && (
          <div className="mt-5 space-y-4 text-left">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-400">기온 (℃)</p>
              <input
                type="range"
                min={20}
                max={42}
                step={0.5}
                value={temp}
                onChange={(e) => setTemp(Number(e.target.value))}
                onMouseUp={handleCommitManualReading}
                onTouchEnd={handleCommitManualReading}
                className="w-full accent-sky-500"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>20℃</span>
                <span className="font-bold text-slate-600">{temp}℃</span>
                <span>42℃</span>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-400">습도 (%)</p>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={humidity}
                onChange={(e) => setHumidity(Number(e.target.value))}
                onMouseUp={handleCommitManualReading}
                onTouchEnd={handleCommitManualReading}
                className="w-full accent-sky-500"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>0%</span>
                <span className="font-bold text-slate-600">{humidity}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 현재 체감온도 단계별 필요 조치 */}
      <div className={`animate-slide-up rounded-2xl p-5 shadow-xl ${rule.bg}`}>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">필요 조치</span>
          {/* 35℃ 이상(위험·매우위험)에서는 기존 법적 의무(2시간마다 20분)가 사라지지 않고
              추가 권고와 함께 적용되므로, 두 태그를 모두 보여준다 */}
          {(tier === "위험" || tier === "매우위험" ? ["법적 의무", rule.legal] : [rule.legal]).map(
            (label) => (
              <span
                key={label}
                className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-slate-500"
              >
                {label}
              </span>
            )
          )}
        </div>
        {/* 필요 조치는 관리자가 수동 설정한 휴식 정책과 무관하게, 실제 법적 의무/권고 기준을 그대로 보여준다 */}
        <p className={`text-sm font-medium leading-relaxed ${rule.color}`}>
          {TIER_RULES[tier].description}
        </p>
        {rule.outdoorNote && (
          <p className="mt-3 rounded-xl bg-white/60 px-3 py-2 text-xs font-semibold text-[#FF0000]">
            ☀️ {rule.outdoorNote} (옥외 작업자 기준)
          </p>
        )}

        {tier !== "정상" && (
          <div className="mt-4 border-t border-white/60 pt-4 text-left">
            <p className="mb-2 text-xs font-semibold text-slate-500">휴식 주기 (수동 설정)</p>
            <div className="flex overflow-hidden rounded-full border border-slate-200 bg-white">
              {(Object.keys(REST_POLICIES) as (keyof typeof REST_POLICIES)[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handleChangeRestPolicy(key)}
                  className={`flex-1 py-2 text-xs font-bold transition-all ${
                    restPolicy === key ? "bg-sky-500 text-white" : "text-slate-400"
                  }`}
                >
                  {REST_POLICIES[key].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="작업 중" value={workingCount} color="text-slate-700" />
        <SummaryCard label="휴식 중" value={restingCount} color="text-sky-600" />
        <SummaryCard label="휴식 초과" value={overdueCount} color="text-red-600" />
      </div>

      {/* 작업자 추가 */}
      <form
        onSubmit={handleAddWorker}
        className="animate-slide-up flex gap-2 rounded-2xl bg-white p-3 shadow-xl"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="작업자 이름 추가"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-sky-500"
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition-all hover:scale-105 hover:bg-slate-900 active:scale-95"
        >
          + 추가
        </button>
      </form>

      {/* 일괄 상태 변경 (해당 전환이 유효한 상태의 작업자에게만 적용됩니다) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleBulkRestStart}
          disabled={workers.length === 0 || !rule.restDurationMin}
          className="animate-slide-up rounded-2xl bg-sky-500 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          전체 휴식 시작
        </button>
        <button
          onClick={handleBulkWorkResume}
          disabled={workers.length === 0}
          className="animate-slide-up rounded-2xl bg-slate-800 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-slate-900 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          전체 작업 복귀
        </button>
        <button
          onClick={handleBulkWorkStart}
          disabled={workers.length === 0}
          className="animate-slide-up rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          전체 작업 시작
        </button>
        <button
          onClick={handleBulkWorkEnd}
          disabled={workers.length === 0}
          className="animate-slide-up rounded-2xl bg-slate-200 py-3 text-sm font-bold text-slate-600 shadow-md transition-all hover:scale-105 hover:bg-slate-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        >
          전체 작업 종료
        </button>
      </div>

      {/* 작업자 리스트 */}
      <div className="flex flex-col gap-2">
        {workers.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">
            아직 등록된 작업자가 없습니다. 위 4자리 코드를 작업자에게 공유하세요.
          </p>
        )}
        {workers.map((w) => (
          <WorkerRow
            key={w.id}
            worker={w}
            rule={rule}
            now={now}
            onRestStart={handleRestStartFor}
            onWorkResume={handleWorkResumeFor}
            onWorkStart={handleWorkStartFor}
            onWorkEnd={handleWorkEndFor}
            onDelete={handleDeleteWorker}
          />
        ))}
      </div>

      <button
        onClick={handleExportCsv}
        className="animate-slide-up w-full rounded-2xl bg-emerald-500 py-4 text-base font-black text-white shadow-lg transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95"
      >
        ⬇ 오늘 기록 내보내기 (CSV) · {logs.length}건
      </button>

      <LegalAccordion />
      <IllnessGuideList focus={illnessFocus} />

      <button
        onClick={handleExit}
        className="mt-2 text-center text-xs font-medium text-slate-400 underline underline-offset-2"
      >
        다른 현장 관리하기
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="animate-slide-up rounded-2xl bg-white p-4 text-center shadow-xl transition-all hover:scale-105">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function WorkerRow({
  worker,
  rule,
  now,
  onRestStart,
  onWorkResume,
  onWorkStart,
  onWorkEnd,
  onDelete,
}: {
  worker: Worker;
  rule: (typeof TIER_RULES)[Tier];
  now: number;
  onRestStart: (w: Worker) => void;
  onWorkResume: (w: Worker) => void;
  onWorkStart: (w: Worker) => void;
  onWorkEnd: (w: Worker) => void;
  onDelete: (w: Worker) => void;
}) {
  let remainingLabel = "-";
  if ((worker.rest_status === "resting" || worker.rest_status === "overdue") && worker.rest_started_at) {
    const elapsed = (now - new Date(worker.rest_started_at).getTime()) / 1000;
    remainingLabel = `휴식 시작으로부터 ${formatElapsed(elapsed)}`;
  } else if (worker.rest_status === "working" && worker.tier_entered_at) {
    const elapsed = (now - new Date(worker.tier_entered_at).getTime()) / 1000;
    remainingLabel = `마지막 휴식으로부터 ${formatElapsed(elapsed)}`;
  }

  const restNeeded = isRestNeeded(worker.rest_status, worker.tier_entered_at, rule.workIntervalMin, now);

  const statusLabel =
    restNeeded
      ? "휴식 필요"
      : worker.rest_status === "working"
      ? "작업 중"
      : worker.rest_status === "resting"
      ? "휴식 중"
      : worker.rest_status === "overdue"
      ? "휴식 초과"
      : "작업 종료";

  const statusColor = restNeeded
    ? "bg-orange-500 text-white"
    : worker.rest_status === "working"
    ? "bg-slate-100 text-slate-600"
    : worker.rest_status === "resting"
    ? "bg-sky-100 text-sky-600"
    : worker.rest_status === "overdue"
    ? "bg-red-100 text-red-600"
    : "bg-slate-100 text-slate-400";

  return (
    <div
      className={`animate-slide-up flex items-center justify-between rounded-2xl bg-white p-4 shadow-md transition-all ${
        worker.rest_status === "overdue"
          ? "ring-2 ring-red-400"
          : restNeeded
          ? "bg-orange-50 ring-2 ring-orange-400"
          : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
          {worker.name.slice(0, 1)}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-slate-700">{worker.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {worker.is_outdoor ? "옥외" : "실내"} · {remainingLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {worker.rest_status === "working" && (
          <>
            <button
              onClick={() => onRestStart(worker)}
              disabled={!rule.restDurationMin}
              className="rounded-full bg-sky-500 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-105 hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:scale-100"
            >
              휴식 시작
            </button>
            <button
              onClick={() => onWorkEnd(worker)}
              className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-all hover:scale-105 hover:bg-slate-300 active:scale-95"
            >
              작업 종료
            </button>
          </>
        )}
        {(worker.rest_status === "resting" || worker.rest_status === "overdue") && (
          <button
            onClick={() => onWorkResume(worker)}
            className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-105 hover:bg-slate-900 active:scale-95"
          >
            작업 복귀
          </button>
        )}
        {worker.rest_status === "off" && (
          <button
            onClick={() => onWorkStart(worker)}
            className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95"
          >
            작업 시작
          </button>
        )}
        <button
          onClick={() => onDelete(worker)}
          aria-label={`${worker.name} 삭제`}
          className="rounded-full px-2 py-1.5 text-xs font-bold text-slate-300 transition-all hover:scale-110 hover:text-red-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
