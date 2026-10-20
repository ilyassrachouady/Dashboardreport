"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-shell">
      <h1>Reporting is temporarily unavailable</h1>
      <p>Your source records have not been changed.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
