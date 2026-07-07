"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import CodeInput from "./CodeInput";

export interface JoinedWorker {
  workerId: string;
  siteId: string;
  code: string;
  name: string;
}

type CodeStatus = "idle" | "checking" | "valid" | "invalid";
type NameStatus = "idle" | "checking" | "available" | "duplicate";

export default function WorkerJoinForm({
  onJoined,
}: {
  onJoined: (w: JoinedWorker) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 현장 코드 4자리가 채워지면 실제 존재하는 현장인지 확인한다.
  // 이름 입력은 코드가 유효한 현장으로 확인된 이후에만 가능하다.
  useEffect(() => {
    if (code.length !== 4) {
      setSiteId(null);
      setCodeStatus("idle");
      return;
    }
    let cancelled = false;
    setCodeStatus("checking");
    supabase
      .from("sites")
      .select("id")
      .eq("join_code", code)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setSiteId(data.id);
          setCodeStatus("valid");
        } else {
          setSiteId(null);
          setCodeStatus("invalid");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // 현장 코드가 유효하다고 확인되면 바로 이름을 입력할 수 있도록 포커스를 옮긴다
  useEffect(() => {
    if (codeStatus !== "valid") return;
    requestAnimationFrame(() => {
      document.getElementById("worker-name")?.focus();
    });
  }, [codeStatus]);

  // 이름이 같은 현장에 이미 등록되어 있는지 중복 확인
  useEffect(() => {
    if (!siteId || !name.trim()) {
      setNameStatus("idle");
      return;
    }
    let cancelled = false;
    setNameStatus("checking");
    const timer = setTimeout(() => {
      supabase
        .from("workers")
        .select("id")
        .eq("site_id", siteId)
        .ilike("name", name.trim())
        .limit(1)
        .then(({ data }) => {
          if (cancelled) return;
          setNameStatus(data && data.length > 0 ? "duplicate" : "available");
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [siteId, name]);

  function handleChangeCode() {
    setName("");
    setNameStatus("idle");
    setCode("");
    setSiteId(null);
    setCodeStatus("idle");
    requestAnimationFrame(() => {
      document.getElementById("worker-site-code")?.focus();
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (codeStatus !== "valid" || !siteId) {
      setError("현장 코드를 확인해주세요.");
      return;
    }
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      // 같은 현장에 동일한 이름(대소문자 무시)이 이미 있으면 새로 만들지 않고 재연결
      let workerId: string | undefined;
      if (nameStatus === "duplicate") {
        const { data: existingList, error: existingErr } = await supabase
          .from("workers")
          .select("id")
          .eq("site_id", siteId)
          .ilike("name", name.trim())
          .order("updated_at", { ascending: false })
          .limit(1);
        if (existingErr) throw existingErr;
        workerId = existingList?.[0]?.id;
      }

      if (!workerId) {
        const { data: worker, error: workerErr } = await supabase
          .from("workers")
          .insert({
            site_id: siteId,
            name: name.trim(),
            is_outdoor: true,
            rest_status: "working",
            tier_entered_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (workerErr) throw workerErr;
        workerId = worker.id;
      }

      if (!workerId) throw new Error("작업자 정보를 가져오지 못했습니다.");

      const joined: JoinedWorker = {
        workerId,
        siteId,
        code,
        name: name.trim(),
      };
      localStorage.setItem("cooltime_worker", JSON.stringify(joined));
      onJoined(joined);
    } catch (err) {
      console.error(err);
      setError("연결 중 오류가 발생했습니다. Supabase 설정을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  const nameLocked = name.trim().length > 0;
  const nameFieldDisabled = codeStatus !== "valid";
  const canSubmit =
    !loading &&
    codeStatus === "valid" &&
    !!name.trim() &&
    (nameStatus === "available" || nameStatus === "duplicate");

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-slide-up w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
    >
      <h2 className="mb-1 text-lg font-bold text-slate-800">현장 참여하기</h2>
      <p className="mb-5 text-sm text-slate-500">
        관리자에게 받은 4자리 현장 코드를 입력하세요.
      </p>

      <div className={`mb-1 flex justify-end ${nameLocked ? "" : "invisible"}`}>
        <button
          type="button"
          tabIndex={nameLocked ? 0 : -1}
          onClick={handleChangeCode}
          className="text-xs font-semibold text-sky-500 underline underline-offset-2"
        >
          코드 변경
        </button>
      </div>
      <div className="mb-1">
        <CodeInput
          id="worker-site-code"
          value={code}
          onChange={setCode}
          disabled={nameLocked}
        />
      </div>
      <p className="mb-4 text-center text-xs font-medium">
        <span
          className={
            codeStatus === "checking"
              ? "text-slate-400"
              : codeStatus === "valid"
              ? "text-emerald-500"
              : codeStatus === "invalid"
              ? "text-red-500"
              : "invisible"
          }
        >
          {codeStatus === "checking"
            ? "확인 중..."
            : codeStatus === "valid"
            ? "현장을 확인했어요"
            : codeStatus === "invalid"
            ? "존재하지 않는 현장 코드입니다."
            : "-"}
        </span>
      </p>

      <label htmlFor="worker-name" className="mb-1 block text-xs font-semibold text-slate-500">
        이름
      </label>
      <input
        id="worker-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={nameFieldDisabled ? "먼저 현장 코드를 입력하세요" : "홍길동"}
        disabled={nameFieldDisabled}
        className="mb-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition-colors focus:border-sky-500 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <p className="mb-4 text-xs font-medium">
        <span
          className={
            nameStatus === "checking"
              ? "text-slate-400"
              : nameStatus === "duplicate"
              ? "text-orange-500"
              : nameStatus === "available"
              ? "text-emerald-500"
              : "invisible"
          }
        >
          {nameStatus === "checking"
            ? "확인 중..."
            : nameStatus === "duplicate"
            ? "이미 사용 중인 이름입니다. 본인이 맞으신가요?"
            : nameStatus === "available"
            ? "사용할 수 있는 이름이에요"
            : "-"}
        </span>
      </p>

      {error && <p className="mb-4 text-sm font-medium text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-xl bg-sky-500 py-3.5 text-base font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
      >
        {loading ? "연결 중..." : "참여하기"}
      </button>
    </form>
  );
}
