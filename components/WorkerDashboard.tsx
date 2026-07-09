"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Site, Tier, Worker } from "@/lib/types";
import {
  formatDurationMin,
  getEffectiveRule,
  getTier,
  isOutdoorRestrictedNow,
  isRestNeeded,
  isTierUp,
  TIER_RULES,
} from "@/lib/tier";
import TierBadge from "./TierBadge";
import CountdownRing from "./CountdownRing";
import LegalAccordion from "./LegalAccordion";
import IllnessGuideList from "./IllnessGuideList";
import SelfDiagnosisModal from "./SelfDiagnosisModal";
import { JoinedWorker } from "./WorkerJoinForm";
import { IllnessType } from "@/lib/types";
import { requestNotificationPermission, notify } from "@/lib/notify";

const POLL_MS = 7000;

export default function WorkerDashboard({
  joined,
  onLeave,
}: {
  joined: JoinedWorker;
  onLeave: () => void;
}) {
  const [site, setSite] = useState<Site | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [siteChecked, setSiteChecked] = useState(false);
  const [workerChecked, setWorkerChecked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const prevTierRef = useRef<Tier | null>(null);
  const restNeededNotifiedRef = useRef(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const fetchSite = useCallback(async () => {
    const { data } = await supabase
      .from("sites")
      .select("*")
      .eq("id", joined.siteId)
      .maybeSingle();
    setSite(data as Site | null);
    setSiteChecked(true);
  }, [joined.siteId]);

  const fetchWorker = useCallback(async () => {
    const { data } = await supabase
      .from("workers")
      .select("*")
      .eq("id", joined.workerId)
      .maybeSingle();
    setWorker(data as Worker | null);
    setWorkerChecked(true);
  }, [joined.workerId]);

  useEffect(() => {
    fetchSite();
    fetchWorker();
    const poll = setInterval(() => {
      fetchSite();
      fetchWorker();
    }, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [fetchSite, fetchWorker]);

  const tier: Tier = site?.feels_like_temp != null ? getTier(site.feels_like_temp) : "정상";
  const rule = getEffectiveRule(tier, site?.rest_policy ?? "2h20m");

  // 상위 단계로 오를 때만 타이머 리셋
  useEffect(() => {
    if (!worker) return;
    if (isTierUp(prevTierRef.current, tier) && prevTierRef.current !== null) {
      supabase
        .from("workers")
        .update({ tier_entered_at: new Date().toISOString() })
        .eq("id", worker.id)
        .then(() => fetchWorker());
      supabase.from("logs").insert({
        site_id: joined.siteId,
        worker_name: joined.name,
        site_temp: site?.feels_like_temp ?? null,
        tier,
        event_type: "TIER_UP",
        note: null,
      });
    }
    prevTierRef.current = tier;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  async function handleRestStart() {
    if (!worker) return;
    const started = new Date().toISOString();
    await supabase
      .from("workers")
      .update({ rest_status: "resting", rest_started_at: started })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: joined.siteId,
      worker_name: joined.name,
      site_temp: site?.feels_like_temp ?? null,
      tier,
      event_type: "REST_START",
      note: null,
    });
    fetchWorker();
  }

  async function handleRestEnd() {
    if (!worker) return;
    await supabase
      .from("workers")
      .update({
        rest_status: "working",
        rest_started_at: null,
        tier_entered_at: new Date().toISOString(),
      })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: joined.siteId,
      worker_name: joined.name,
      site_temp: site?.feels_like_temp ?? null,
      tier,
      event_type: "REST_END",
      note: null,
    });
    fetchWorker();
  }

  async function handleWorkStart() {
    if (!worker) return;
    await supabase
      .from("workers")
      .update({
        rest_status: "working",
        rest_started_at: null,
        tier_entered_at: new Date().toISOString(),
      })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: joined.siteId,
      worker_name: joined.name,
      site_temp: site?.feels_like_temp ?? null,
      tier,
      event_type: "WORK_START",
      note: null,
    });
    fetchWorker();
  }

  async function handleWorkEnd() {
    if (!worker) return;
    await supabase
      .from("workers")
      .update({ rest_status: "off", rest_started_at: null })
      .eq("id", worker.id);
    await supabase.from("logs").insert({
      site_id: joined.siteId,
      worker_name: joined.name,
      site_temp: site?.feels_like_temp ?? null,
      tier,
      event_type: "WORK_END",
      note: null,
    });
    fetchWorker();
  }

  async function toggleOutdoor() {
    if (!worker) return;
    await supabase
      .from("workers")
      .update({ is_outdoor: !worker.is_outdoor })
      .eq("id", worker.id);
    fetchWorker();
  }

  async function handleDiagnosisResolved(type: IllnessType) {
    await supabase.from("logs").insert({
      site_id: joined.siteId,
      worker_name: joined.name,
      site_temp: site?.feels_like_temp ?? null,
      tier,
      event_type: "ILLNESS_REPORTED",
      note: type,
    });
  }

  function handleLeave() {
    localStorage.removeItem("cooltime_worker");
    onLeave();
  }

  // 휴식 초과 자동 감지
  useEffect(() => {
    if (!worker || worker.rest_status !== "resting" || !worker.rest_started_at) return;
    if (!rule.restDurationMin) return;
    const elapsed = (now - new Date(worker.rest_started_at).getTime()) / 1000;
    if (elapsed >= rule.restDurationMin * 60) {
      supabase
        .from("workers")
        .update({ rest_status: "overdue" })
        .eq("id", worker.id)
        .then(() => fetchWorker());
      supabase.from("logs").insert({
        site_id: joined.siteId,
        worker_name: joined.name,
        site_temp: site?.feels_like_temp ?? null,
        tier,
        event_type: "OVERDUE",
        note: null,
      });
      notify("휴식 시간 초과", {
        body: "설정된 휴식 시간이 지났습니다. 작업 복귀 전 확인해주세요.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // 작업 중 휴식이 필요해지는 시점 자동 감지 (알림 1회 발송)
  useEffect(() => {
    restNeededNotifiedRef.current = false;
  }, [worker?.tier_entered_at, worker?.rest_status]);

  useEffect(() => {
    if (!worker || restNeededNotifiedRef.current) return;
    const needed = isRestNeeded(
      worker.rest_status,
      worker.tier_entered_at,
      rule.workIntervalMin,
      now
    );
    if (needed) {
      restNeededNotifiedRef.current = true;
      notify("휴식이 필요해요", {
        body: `${tier} 단계: ${formatDurationMin(rule.restDurationMin ?? 0)} 휴식이 필요합니다.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  // 현장/작업자가 삭제되는 등 세션이 더 이상 유효하지 않으면 참여 화면으로 돌려보낸다
  const sessionInvalid = (siteChecked && !site) || (workerChecked && !worker);

  useEffect(() => {
    if (!sessionInvalid) return;
    localStorage.removeItem("cooltime_worker");
    onLeave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInvalid]);

  if (sessionInvalid) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        현장 정보를 찾을 수 없어요. 다시 참여해주세요...
      </div>
    );
  }

  if (!site || !worker) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        불러오는 중...
      </div>
    );
  }

  const outdoorRestricted = isOutdoorRestrictedNow(tier, worker.is_outdoor);
  const restNeeded = isRestNeeded(worker.rest_status, worker.tier_entered_at, rule.workIntervalMin, now);

  let workElapsed = 0;
  let restElapsed = 0;
  if (worker.tier_entered_at) {
    workElapsed = (now - new Date(worker.tier_entered_at).getTime()) / 1000;
  }
  if (worker.rest_started_at) {
    restElapsed = (now - new Date(worker.rest_started_at).getTime()) / 1000;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-10">
      {/* 상단 정보 */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>👷 {joined.name}</span>
        <span className="flex items-center gap-1.5">
          현장 <span className="font-mono font-bold text-slate-700">{joined.code}</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        </span>
      </div>

      {/* 체감온도 카드: 단계와 무관하게 항상 동일한 배경, 단계 표시는 위젯(TierBadge)만 담당 */}
      <div className="animate-slide-up rounded-2xl bg-white p-6 text-center shadow-xl">
        <p className="mb-1 text-xs font-semibold text-slate-400">현재 체감온도</p>
        <p className="mb-1 text-6xl font-black tracking-tighter text-slate-800">
          {site.feels_like_temp != null ? `${site.feels_like_temp.toFixed(1)}°` : "-"}
        </p>
        <p className="mb-3 text-xs font-semibold text-slate-400">
          현재 온도 {site.temp != null ? `${site.temp}℃` : "-"} · 습도{" "}
          {site.humidity != null ? `${site.humidity}%` : "-"}
        </p>
        <TierBadge tier={tier} size="lg" />
      </div>

      {/* 행동 카드 */}
      <div
        className={`animate-slide-up rounded-2xl p-5 shadow-xl transition-colors ${
          restNeeded ? "bg-orange-50 ring-2 ring-orange-400" : rule.bg
        }`}
      >
        {restNeeded && (
          <p className="animate-pulse-ring mb-3 rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-black text-white">
            지금 휴식이 필요해요!
          </p>
        )}
        {/* 필요 조치는 관리자가 수동 설정한 휴식 정책과 무관하게, 실제 법적 의무/권고 기준을 그대로 보여준다 */}
        <p className={`mb-2 text-sm font-medium leading-relaxed ${rule.color}`}>
          {TIER_RULES[tier].description}
        </p>
        {rule.restDurationMin && (
          <p className="mb-4 inline-block rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-slate-500">
            ⏱ 설정된 휴식 시간: {formatDurationMin(rule.restDurationMin)}
          </p>
        )}
        {/* 상태 표시 영역: 작업 중/휴식 중/휴식 초과/작업 종료 어떤 상태여도 높이가 같도록 고정 */}
        <div className="flex min-h-[84px] flex-col justify-center">
          {worker.rest_status === "working" && rule.workIntervalMin && (
            <CountdownRing
              totalSeconds={rule.workIntervalMin * 60}
              elapsedSeconds={workElapsed}
              label="마지막 휴식으로부터"
              colorClass={restNeeded ? "bg-orange-500" : "bg-slate-700"}
            />
          )}

          {worker.rest_status === "resting" && rule.restDurationMin && (
            <CountdownRing
              totalSeconds={rule.restDurationMin * 60}
              elapsedSeconds={restElapsed}
              label="휴식 시작으로부터"
              colorClass="bg-sky-500"
            />
          )}

          {worker.rest_status === "overdue" && (
            <div className="rounded-xl bg-red-100 px-4 py-3 text-center text-sm font-bold text-red-600">
              ⏰ 휴식 시간이 초과되었습니다!
            </div>
          )}

          {worker.rest_status === "off" && (
            <div className="rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-bold text-slate-500">
              🌙 작업이 종료된 상태예요
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          {worker.rest_status === "working" && (
            <>
              <button
                onClick={handleRestStart}
                disabled={!rule.restDurationMin}
                className={`flex-1 rounded-xl py-3.5 text-base font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:scale-100 ${
                  restNeeded ? "bg-orange-500 hover:bg-orange-600" : "bg-slate-800 hover:bg-slate-900"
                }`}
              >
                휴식 타이머 시작
              </button>
              <button
                onClick={handleWorkEnd}
                className="flex-1 rounded-xl bg-slate-200 py-3.5 text-base font-bold text-slate-600 shadow-md transition-all hover:scale-105 hover:bg-slate-300 active:scale-95"
              >
                작업 종료
              </button>
            </>
          )}
          {(worker.rest_status === "resting" || worker.rest_status === "overdue") && (
            <button
              onClick={handleRestEnd}
              className="w-full rounded-xl bg-sky-500 py-3.5 text-base font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-sky-600 active:scale-95"
            >
              작업 복귀
            </button>
          )}
          {worker.rest_status === "off" && (
            <button
              onClick={handleWorkStart}
              className="w-full rounded-xl bg-emerald-500 py-3.5 text-base font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-emerald-600 active:scale-95"
            >
              작업 시작
            </button>
          )}
        </div>
      </div>

      {/* 자가진단 버튼 */}
      <button
        onClick={() => setShowDiagnosis(true)}
        className="animate-slide-up flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-4 text-base font-black text-white shadow-lg transition-all hover:scale-105 hover:bg-red-600 active:scale-95"
      >
        🚨 몸이 안 좋아요 · 자가진단
      </button>

      {/* 옥외/실내 토글 */}
      <div className="animate-slide-up flex items-center justify-between rounded-2xl bg-white p-4 shadow-xl">
        <div>
          <p className="text-sm font-semibold text-slate-700">작업 환경</p>
          <p className="text-xs text-slate-400">
            {outdoorRestricted
              ? "지금은 옥외 작업 제한 시간대예요"
              : worker.is_outdoor && rule.outdoorNote
              ? rule.outdoorNote
              : " "}
          </p>
        </div>
        <div className="flex overflow-hidden rounded-full border border-slate-200">
          <button
            onClick={() => !worker.is_outdoor && toggleOutdoor()}
            className={`px-4 py-2 text-sm font-bold transition-all ${
              worker.is_outdoor ? "bg-sky-500 text-white" : "text-slate-400"
            }`}
          >
            옥외
          </button>
          <button
            onClick={() => worker.is_outdoor && toggleOutdoor()}
            className={`px-4 py-2 text-sm font-bold transition-all ${
              !worker.is_outdoor ? "bg-sky-500 text-white" : "text-slate-400"
            }`}
          >
            실내
          </button>
        </div>
      </div>

      <LegalAccordion />
      <IllnessGuideList />

      <button
        onClick={handleLeave}
        className="mt-2 text-center text-xs font-medium text-slate-400 underline underline-offset-2"
      >
        현장에서 나가기
      </button>

      {showDiagnosis && (
        <SelfDiagnosisModal
          onClose={() => setShowDiagnosis(false)}
          onResolved={handleDiagnosisResolved}
        />
      )}
    </div>
  );
}
