import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-white px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <CoolTimeLogo />

        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">쿨타임</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            폭염 속 작업, 지금 쉬어야 할 때를 알려드려요.
            <br />
            체감온도 기준 휴식 의무를 실시간으로 확인하세요.
          </p>
        </div>

        <div className="flex w-full flex-col gap-4">
          <Link
            href="/worker"
            className="group animate-slide-up flex items-center justify-between rounded-2xl bg-white p-5 shadow-xl transition-all hover:scale-105"
          >
            <div>
              <p className="text-xs font-semibold text-sky-500">작업자 모드</p>
              <p className="mt-1 text-lg font-bold text-slate-800">지금 쉬어야 할까요?</p>
              <p className="mt-1 text-xs text-slate-400">
                체감온도 확인 · 휴식 타이머 · 자가진단
              </p>
            </div>
            <span className="text-2xl transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>

          <Link
            href="/admin"
            className="group animate-slide-up flex items-center justify-between rounded-2xl bg-slate-800 p-5 shadow-xl transition-all hover:scale-105"
          >
            <div>
              <p className="text-xs font-semibold text-sky-300">관리자 모드</p>
              <p className="mt-1 text-lg font-bold text-white">현장을 관리해요</p>
              <p className="mt-1 text-xs text-slate-400">
                작업자 현황 · 긴급 알림 · 기록 CSV 추출
              </p>
            </div>
            <span className="text-2xl text-white transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          산업안전보건기준에 관한 규칙 제558~562조 (2025.7.17 시행) 기반 · 계정 없이 4자리
          현장 코드로 이용해요
        </p>
      </div>
    </main>
  );
}

function CoolTimeLogo() {
  return (
    <svg
      viewBox="0 0 150 100"
      className="h-24 w-36 animate-slide-up drop-shadow-sm"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="75" cy="50" r="42" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="4" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line
          key={deg}
          x1={75 + 36 * Math.sin((deg * Math.PI) / 180)}
          y1={50 - 36 * Math.cos((deg * Math.PI) / 180)}
          x2={75 + 40 * Math.sin((deg * Math.PI) / 180)}
          y2={50 - 40 * Math.cos((deg * Math.PI) / 180)}
          stroke="#0284c7"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      {/* 시침: 온도계 모양, 코랄 */}
      <line x1="75" y1="50" x2="58" y2="34" stroke="#ff6b4d" strokeWidth="5" strokeLinecap="round" />
      <circle cx="58" cy="34" r="5" fill="#ff6b4d" />
      {/* 분침: 파랑 */}
      <line x1="75" y1="50" x2="98" y2="62" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" />
      <circle cx="75" cy="50" r="4.5" fill="#0f172a" />
    </svg>
  );
}
