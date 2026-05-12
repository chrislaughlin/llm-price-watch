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
    <main className="min-h-screen bg-[#f4f1ea] px-6 py-8 text-[#171512]">
      <section className="mx-auto max-w-7xl rounded-[2rem] border border-[#171512]/15 bg-[#fffaf0] p-6 shadow-[6px_6px_0_#d8c7a3]">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#766b5e]">Model ledger</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">Loading model catalogue…</h1>
      </section>
    </main>
  );
}
