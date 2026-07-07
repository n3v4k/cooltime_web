"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WorkerJoinForm, { JoinedWorker } from "@/components/WorkerJoinForm";
import WorkerDashboard from "@/components/WorkerDashboard";

export default function WorkerPage() {
  const [joined, setJoined] = useState<JoinedWorker | null | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem("cooltime_worker");
    if (raw) {
      try {
        setJoined(JSON.parse(raw));
      } catch {
        setJoined(null);
      }
    } else {
      setJoined(null);
    }
  }, []);

  if (joined === undefined) {
    return <div className="min-h-screen bg-sky-50" />;
  }

  if (!joined) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-b from-sky-100 to-sky-50 px-4">
        <Link href="/" className="text-sm font-medium text-sky-600 underline">
          ← 처음으로
        </Link>
        <WorkerJoinForm onJoined={setJoined} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-50">
      <WorkerDashboard joined={joined} onLeave={() => setJoined(null)} />
    </main>
  );
}
