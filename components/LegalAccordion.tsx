"use client";

import { useState } from "react";

export default function LegalAccordion() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
      >
        📜 법적 근거 요약
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center transition-transform duration-300 ${
            open ? "rotate-180" : ""
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
      {open && (
        <div className="animate-slide-up space-y-3 px-4 pb-4 text-sm leading-relaxed text-slate-600">
          <p>
            산업안전보건기준에 관한 규칙 제558~562조 (2025.7.17 시행)에 따라
            체감온도별 작업중지·휴식 의무가 적용됩니다.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>31℃ 이상: 2시간 연속작업 시 조치 의무</li>
            <li>33℃ 이상: 2시간마다 20분 휴식 의무</li>
            <li>35℃ 이상: 1시간마다 15분 휴식 + 오후 2~5시 옥외작업 중지 권고</li>
            <li>38℃ 이상: 옥외작업 전면중지 권고</li>
          </ul>

          <div className="border-t border-slate-100 pt-3">
            <p className="mb-1 font-semibold text-slate-700">
              2026.6.1 시행 개정안: 폭염·온열질환 예방 보건조치 의무화
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold">'폭염' 법적 정의 신설</span> — 근로자에게
                열경련·열탈진·열사병을 유발할 수 있는 기상 상황을 '폭염'으로 명시
              </li>
              <li>
                <span className="font-semibold">현장 조치 의무</span> — 폭염 작업장 내
                체감온도계 비치 및 측정, 근로시간 조정, 적정 휴식시간 부여가 의무화
              </li>
              <li>위반 시 사업주에게 강력한 벌칙이 적용될 수 있습니다.</li>
            </ul>
          </div>

          <p className="text-xs text-slate-400">
            2025.6.13 대전지방법원 판결에서 휴식시간·그늘막·물·소금 미비치로 인한
            온열질환 사망 사건에 대해 안전보건관리자 및 원청 대표이사가 처벌된 사례가
            있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
