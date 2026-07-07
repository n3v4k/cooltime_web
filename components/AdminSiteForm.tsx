"use client";

import { useEffect, useState } from "react";
import { supabase, generateJoinCode } from "@/lib/supabase";
import CodeInput from "./CodeInput";

export interface AdminSite {
  siteId: string;
  code: string;
  name: string;
}

type NameStatus = "idle" | "checking" | "available" | "duplicate";
type CodeStatus = "idle" | "checking" | "valid" | "invalid";

interface FoundSite {
  id: string;
  join_code: string;
  name: string | null;
}

export default function AdminSiteForm({ onReady }: { onReady: (s: AdminSite) => void }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [nameStatus, setNameStatus] = useState<NameStatus>("idle");
  const [codeStatus, setCodeStatus] = useState<CodeStatus>("idle");
  const [foundSite, setFoundSite] = useState<FoundSite | null>(null);
  const [showInvalidCode, setShowInvalidCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 현장 이름 중복 확인 (같은 이름의 현장이 이미 있으면 생성 버튼 비활성화)
  useEffect(() => {
    if (mode !== "create" || !name.trim()) {
      setNameStatus("idle");
      return;
    }
    let cancelled = false;
    setNameStatus("checking");
    const timer = setTimeout(() => {
      supabase
        .from("sites")
        .select("id")
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
  }, [mode, name]);

  // 현장 코드 4자리가 채워지면 실제 존재하는 현장인지 확인한다.
  useEffect(() => {
    if (mode !== "join" || code.length !== 4) {
      setCodeStatus("idle");
      setFoundSite(null);
      return;
    }
    let cancelled = false;
    setCodeStatus("checking");
    supabase
      .from("sites")
      .select("*")
      .eq("join_code", code)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setFoundSite(data as FoundSite);
          setCodeStatus("valid");
        } else {
          setFoundSite(null);
          setCodeStatus("idle");
          // 존재하지 않는 코드: 입력을 비우고 첫 칸으로 포커스, 안내 문구는 새로 입력하면 사라짐
          setCode("");
          setShowInvalidCode(true);
          requestAnimationFrame(() => {
            document.getElementById("admin-join-code")?.focus();
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, code]);

  function handleCodeChange(v: string) {
    setShowInvalidCode(false);
    setCode(v);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("현장 이름을 입력해주세요.");
      return;
    }
    if (nameStatus === "duplicate") {
      setError("이미 존재하는 현장 이름입니다.");
      return;
    }

    setLoading(true);
    try {
      let joinCode = generateJoinCode();
      for (let i = 0; i < 5; i++) {
        const { data: exists } = await supabase
          .from("sites")
          .select("id")
          .eq("join_code", joinCode)
          .maybeSingle();
        if (!exists) break;
        joinCode = generateJoinCode();
      }

      const { data, error: err } = await supabase
        .from("sites")
        .insert({ join_code: joinCode, name: name.trim(), tier: "정상" })
        .select()
        .single();
      if (err) throw err;

      const site: AdminSite = { siteId: data.id, code: data.join_code, name: data.name };
      localStorage.setItem("cooltime_admin_site", JSON.stringify(site));
      onReady(site);
    } catch (err) {
      console.error(err);
      setError("현장 생성 중 오류가 발생했습니다. Supabase 설정을 확인해주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (codeStatus !== "valid" || !foundSite) {
      setError("현장 코드를 확인해주세요.");
      return;
    }
    setLoading(true);
    try {
      const site: AdminSite = {
        siteId: foundSite.id,
        code: foundSite.join_code,
        name: foundSite.name ?? "",
      };
      localStorage.setItem("cooltime_admin_site", JSON.stringify(site));
      onReady(site);
    } catch (err) {
      console.error(err);
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-slide-up w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex overflow-hidden rounded-full border border-slate-200">
        <button
          onClick={() => setMode("create")}
          className={`flex-1 py-2.5 text-sm font-bold transition-all ${
            mode === "create" ? "bg-sky-500 text-white" : "text-slate-400"
          }`}
        >
          새 현장 만들기
        </button>
        <button
          onClick={() => setMode("join")}
          className={`flex-1 py-2.5 text-sm font-bold transition-all ${
            mode === "join" ? "bg-sky-500 text-white" : "text-slate-400"
          }`}
        >
          기존 현장 관리
        </button>
      </div>

      {mode === "create" ? (
        <form onSubmit={handleCreate}>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            현장 이름
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: OO아파트 신축현장"
            className="mb-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none focus:border-sky-500"
          />
          <p className="mb-4 text-xs font-medium">
            {nameStatus === "checking" && <span className="text-slate-400">확인 중...</span>}
            {nameStatus === "duplicate" && (
              <span className="text-red-500">이미 존재하는 현장 이름입니다.</span>
            )}
            {nameStatus === "available" && (
              <span className="text-emerald-500">사용할 수 있는 이름이에요</span>
            )}
          </p>
          {error && <p className="mb-4 text-sm font-medium text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !name.trim() || nameStatus === "duplicate" || nameStatus === "checking"}
            className="w-full rounded-xl bg-sky-500 py-3.5 text-base font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {loading ? "생성 중..." : "현장 생성하고 코드 발급받기"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleJoin}>
          <label className="mb-1 block text-xs font-semibold text-slate-500">
            현장 코드 (4자리)
          </label>
          <div className="mb-1">
            <CodeInput id="admin-join-code" value={code} onChange={handleCodeChange} />
          </div>
          <p className="mb-4 text-center text-xs font-medium">
            <span
              className={
                codeStatus === "checking"
                  ? "text-slate-400"
                  : codeStatus === "valid"
                  ? "text-emerald-500"
                  : showInvalidCode
                  ? "text-red-500"
                  : "invisible"
              }
            >
              {codeStatus === "checking"
                ? "확인 중..."
                : codeStatus === "valid"
                ? "현장을 확인했어요"
                : showInvalidCode
                ? "존재하지 않는 현장 코드입니다."
                : "-"}
            </span>
          </p>
          {error && <p className="mb-4 text-sm font-medium text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || codeStatus !== "valid"}
            className="w-full rounded-xl bg-sky-500 py-3.5 text-base font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {loading ? "조회 중..." : "관리 화면 열기"}
          </button>
        </form>
      )}
    </div>
  );
}
