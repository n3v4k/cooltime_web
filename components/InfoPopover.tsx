"use client";

import { useEffect, useRef, useState } from "react";

export default function InfoPopover({ text }: { text: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  // 조상 요소에 transform(예: animate-slide-up)이 걸려 있으면 position:fixed 오버레이가
  // 뷰포트가 아니라 그 조상 기준으로 갇혀버리므로, 문서 전역 클릭 감지로 닫는다.
  useEffect(() => {
    if (!open) return;
    function handleClick() {
      setOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="안내 보기"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-[11px] font-bold text-slate-400 transition-colors hover:border-sky-400 hover:text-sky-500"
      >
        i
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 text-left text-xs leading-relaxed text-slate-600 shadow-xl">
          {text}
        </div>
      )}
    </span>
  );
}
