"use client";

import { useRef, useState } from "react";

export default function CodeInput({
  value,
  onChange,
  id,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const digits = [0, 1, 2, 3].map((i) => value[i] ?? "");

  function setDigit(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);

    if (!char) {
      const next = digits.slice();
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    // 클릭한 칸이 비어있다면, 실제로 채워야 할 가장 앞쪽 빈 칸에 입력한다
    // (건너뛰어 클릭해도 숫자는 순서대로 채워지고 포커스도 그 칸으로 이동)
    const firstEmpty = digits.indexOf("");
    const targetIndex = digits[index] === "" && firstEmpty !== -1 ? firstEmpty : index;

    const next = digits.slice();
    next[targetIndex] = char;
    onChange(next.join("").slice(0, 4));

    if (targetIndex < 3) {
      inputRefs.current[targetIndex + 1]?.focus();
    }
    // 마지막 칸을 채운 뒤에는 포커스를 그대로 유지한다
    // (코드가 틀렸을 때 바로 지우고 다시 입력할 수 있도록)
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = digits.slice();
      next[index - 1] = "";
      onChange(next.join(""));
      e.preventDefault();
    }
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, 3);
    inputRefs.current[focusIndex]?.focus();
  }

  return (
    <div className="flex justify-center gap-2.5">
      {digits.map((digit, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          value={digit}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => {
            setFocusedIndex(i);
            e.target.select();
          }}
          onBlur={() => setFocusedIndex((cur) => (cur === i ? null : cur))}
          placeholder={focusedIndex === i ? "" : "0"}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          className="h-14 w-12 rounded-xl border-2 border-slate-200 text-center text-2xl font-black text-slate-800 outline-none transition-colors focus:border-sky-500 disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
        />
      ))}
    </div>
  );
}
