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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt="쿨타임 로고"
      className="h-24 w-24 animate-slide-up drop-shadow-sm"
    />
  );
}
