"use client";

import { useState } from "react";
import { ILLNESS_GUIDE } from "@/lib/illness";

export default function IllnessGuideList() {
  const [openType, setOpenType] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-sm font-semibold text-slate-700">
        🩹 온열질환 종류 및 대처법
      </h3>
      {ILLNESS_GUIDE.map((g) => {
        const isOpen = openType === g.type;
        const emergency = g.severity === "emergency";
        return (
          <div
            key={g.type}
            className={`overflow-hidden rounded-2xl border shadow-sm transition-all ${
              emergency ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"
            }`}
          >
            <button
              onClick={() => setOpenType(isOpen ? null : g.type)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span
                className={`text-sm font-bold ${
                  emergency ? "text-red-700" : "text-slate-700"
                }`}
              >
                {emergency ? "🚨 " : "⚠️ "}
                {g.type}
              </span>
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-full w-full">
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            {isOpen && (
              <div className="animate-slide-up space-y-2 px-4 pb-4 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-700">증상: </span>
                  {g.symptoms}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">대처: </span>
                  {g.treatment}
                </p>
              </div>
            )}
          </div>
        );
      })}
      <p className="px-1 text-xs text-slate-400">
        본 정보는 참고용 안전 정보이며, 실제 응급 상황에서는 전문 의료기관의 진단과
        처치를 최우선으로 합니다.
      </p>
    </div>
  );
}
