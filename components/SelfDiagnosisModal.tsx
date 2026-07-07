"use client";

import { useState } from "react";
import { Q1, Q2, Q3, resolveDiagnosis, getGuide } from "@/lib/illness";
import { IllnessType } from "@/lib/types";

interface Props {
  onClose: () => void;
  onResolved: (type: IllnessType) => void;
}

type Step = "q1" | "q2" | "q3" | "result";

export default function SelfDiagnosisModal({ onClose, onResolved }: Props) {
  const [step, setStep] = useState<Step>("q1");
  const [answers, setAnswers] = useState<{ q1?: string; q2?: string; q3?: string }>({});
  const [result, setResult] = useState<{ type: IllnessType; uncertain: boolean } | null>(
    null
  );

  function answer(key: "q1" | "q2" | "q3", value: string) {
    const next = { ...answers, [key]: value };
    setAnswers(next);

    if (key === "q1" && value === "yes") {
      const r = resolveDiagnosis(next);
      setResult(r);
      setStep("result");
      onResolved(r.type);
      return;
    }
    if (key === "q1") {
      setStep("q2");
      return;
    }
    if (key === "q2" && value !== "none") {
      const r = resolveDiagnosis(next);
      setResult(r);
      setStep("result");
      onResolved(r.type);
      return;
    }
    if (key === "q2") {
      setStep("q3");
      return;
    }
    if (key === "q3") {
      const r = resolveDiagnosis(next);
      setResult(r);
      setStep("result");
      onResolved(r.type);
    }
  }

  const progressStep = step === "q1" ? 1 : step === "q2" ? 2 : step === "q3" ? 3 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="animate-slide-up w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        {step !== "result" && (
          <>
            <div className="mb-4 flex items-center gap-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${
                    i <= progressStep ? "bg-red-500" : "bg-slate-100"
                  }`}
                />
              ))}
            </div>
            <p className="mb-1 text-xs font-semibold text-red-500">
              온열질환 자가진단 · {progressStep}/3
            </p>
          </>
        )}

        {step === "q1" && (
          <QuestionBlock
            question={Q1.question}
            options={Q1.options}
            onSelect={(v) => answer("q1", v)}
          />
        )}
        {step === "q2" && (
          <QuestionBlock
            question={Q2.question}
            options={Q2.options}
            onSelect={(v) => answer("q2", v)}
          />
        )}
        {step === "q3" && (
          <QuestionBlock
            question={Q3.question}
            options={Q3.options}
            onSelect={(v) => answer("q3", v)}
          />
        )}

        {step === "result" && result && <ResultBlock result={result} />}

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-500 transition-all hover:scale-[1.02] hover:bg-slate-50"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function QuestionBlock({
  question,
  options,
  onSelect,
}: {
  question: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="animate-slide-up">
      <h2 className="mb-6 text-xl font-bold leading-snug text-slate-800">{question}</h2>
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className="w-full rounded-2xl bg-slate-800 py-4 text-base font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-slate-900 active:scale-95"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultBlock({
  result,
}: {
  result: { type: IllnessType; uncertain: boolean };
}) {
  if (result.uncertain || !result.type) {
    return (
      <div className="animate-slide-up text-center">
        <div className="mb-2 text-4xl">🤔</div>
        <h2 className="mb-2 text-lg font-bold text-slate-700">유형 특정이 어려워요</h2>
        <p className="text-sm text-slate-500">
          증상표를 참고하고 경과를 관찰하세요. 증상이 지속되거나 악화되면 즉시 병원
          진료를 받으세요.
        </p>
      </div>
    );
  }

  if (result.type === "열사병") {
    return (
      <div className="animate-slide-up text-center">
        <div className="mb-3 animate-pulse-ring text-5xl">🚨</div>
        <h2 className="mb-2 text-2xl font-black text-red-600">열사병 의심</h2>
        <p className="mb-5 text-sm font-medium text-red-500">
          최고 위험 단계입니다. 즉시 119에 신고하세요.
        </p>
        <a
          href="tel:119"
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 text-lg font-black text-white shadow-lg transition-all hover:scale-105 hover:bg-red-700 active:scale-95"
        >
          📞 119 신고하기
        </a>
        <p className="text-left text-sm leading-relaxed text-slate-600">
          {getGuide("열사병").treatment}
        </p>
        <p className="mt-2 text-xs font-semibold text-red-400">
          관리자에게 긴급 알림이 자동으로 전송됩니다.
        </p>
      </div>
    );
  }

  const guide = getGuide(result.type);
  return (
    <div className="animate-slide-up">
      <div className="mb-3 text-center text-4xl">⚠️</div>
      <h2 className="mb-2 text-center text-xl font-bold text-orange-600">
        {result.type} 의심
      </h2>
      <div className="mt-4 space-y-3 rounded-2xl bg-orange-50 p-4 text-sm leading-relaxed text-slate-700">
        <p>
          <span className="font-semibold">증상: </span>
          {guide.symptoms}
        </p>
        <p>
          <span className="font-semibold">대처: </span>
          {guide.treatment}
        </p>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        증상이 1시간 이상 지속되면 병원 진료를 받으세요. 결과는 관리자 화면에도
        기록됩니다.
      </p>
    </div>
  );
}
