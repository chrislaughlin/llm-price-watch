import { Dashboard } from "@/components/dashboard";
import { getDashboardData } from "@/lib/data";
import { connection } from "next/server";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardData />
    </Suspense>
  );
}

async function DashboardData() {
  await connection();
  const data = await getDashboardData();
  return <Dashboard data={data} />;
}

function DashboardFallback() {
  return (
    <main className="min-h-screen bg-[#060816] px-6 py-8 text-slate-100">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-[#0b1022] p-6 shadow-2xl shadow-black/40">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200">Model ledger</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Loading model leaderboard…</h1>
      </section>
    </main>
  );
}
