import { TopNav } from "@/components/ui/TopNav";

export default function ProfilePage() {
  return (
    <div className="flex flex-col min-h-dvh">
      <TopNav />
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <i className="ri-user-line text-4xl text-text-muted" />
          <h1 className="text-xl font-semibold">Portfolio</h1>
          <p className="text-sm text-text-muted">
            Connect your wallet to see balances, PnL, and activity
          </p>
        </div>
      </main>
    </div>
  );
}
