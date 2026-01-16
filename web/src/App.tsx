import { useMemo, useState } from "react";
import { Select } from "./components/Select";
import { readPublicEnv } from "./lib/env";
import { getSupabaseClient } from "./lib/supabaseClient";
import type { Budget, Mood, PlacePref, RecommendResponse } from "./types";

function App() {
  function confidenceTone(confidence: number) {
    if (confidence >= 75) return "high";
    if (confidence >= 55) return "mid";
    return "low";
  }

  function confidenceClasses(confidence: number) {
    const t = confidenceTone(confidence);
    if (t === "high") return { pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200", bar: "bg-linear-to-r from-emerald-300 to-sky-300" };
    if (t === "mid") return { pill: "border-sky-500/30 bg-sky-500/10 text-sky-200", bar: "bg-linear-to-r from-sky-300 to-fuchsia-300" };
    return { pill: "border-amber-500/30 bg-amber-500/10 text-amber-200", bar: "bg-linear-to-r from-amber-300 to-rose-300" };
  }

  const env = readPublicEnv();
  const supabase = useMemo(
    () => (env.ok ? getSupabaseClient(env.supabaseUrl, env.supabaseAnonKey) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [env.ok],
  );

  const [city, setCity] = useState("Istanbul");
  const [mood, setMood] = useState<Mood>("chill");
  const [budget, setBudget] = useState<Budget>("low");
  const [place, setPlace] = useState<PlacePref>("either");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendResponse | null>(null);

  const placeOptions = [
    { value: "either", label: "Either" },
    { value: "indoor", label: "Indoor" },
    { value: "outdoor", label: "Outdoor" },
  ] as const;
  const moodOptions = [
    { value: "chill", label: "Chill" },
    { value: "social", label: "Social" },
    { value: "active", label: "Active" },
    { value: "focus", label: "Focus" },
    { value: "surprise", label: "Surprise" },
  ] as const;
  const budgetOptions = [
    { value: "free", label: "Free" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ] as const;

  async function onRecommend() {
    if (!supabase) {
      setError(env.ok ? "Could not create Supabase client." : env.message);
      return;
    }
    const c = city.trim();
    if (!c) {
      setError("City cannot be empty.");
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const { data, error } = await supabase.functions.invoke<RecommendResponse>("recommend", {
        body: { city: c, preferences: { mood, budget, place } },
      });

      if (error) throw error;
      if (!data) throw new Error("Empty response.");

      setData(data);
    } catch (e: unknown) {
      const raw =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Unknown error";

      // Common local-dev case: Supabase local stack not running -> connection refused.
      if (
        raw.includes("Failed to send a request to the Edge Function") ||
        raw.includes("ERR_CONNECTION_REFUSED") ||
        raw.includes("ECONNREFUSED")
      ) {
        setError(
          "Could not reach the Edge Function (connection refused). If you're using local Supabase, start Docker, then run `npx supabase start` and `npx supabase functions serve recommend ...`.",
        );
      } else {
        setError(raw || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            PlanByWeather (local)
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50">
            What should I do today?
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            A few ideas, tuned to your day in{" "}
            <span className="bg-linear-to-r from-sky-300 via-emerald-300 to-fuchsia-300 bg-clip-text font-medium text-transparent">
              seconds
            </span>
            .
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">City</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. London"
                className="h-11 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-zinc-100 outline-none ring-0 placeholder:text-zinc-600 focus:border-zinc-700"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Preference</span>
              <Select<PlacePref>
                value={place}
                onChange={setPlace}
                options={placeOptions}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Mood</span>
              <Select<Mood> value={mood} onChange={setMood} options={moodOptions} />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-zinc-300">Budget</span>
              <Select<Budget> value={budget} onChange={setBudget} options={budgetOptions} />
            </label>
          </div>

          <div className="mt-5 flex justify-center">
            <button
              onClick={onRecommend}
              disabled={loading || !supabase}
              className={[
                "relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-xl px-5 text-sm font-semibold text-zinc-950",
                "bg-linear-to-r from-sky-300 via-emerald-300 to-fuchsia-300",
                "shadow-lg shadow-emerald-500/10 ring-1 ring-white/10",
                "transition hover:brightness-110 active:brightness-95",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70",
                "disabled:cursor-not-allowed disabled:opacity-60",
              ].join(" ")}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/25 border-t-zinc-950" />
                  Loading…
                </>
              ) : (
                "Get recommendations"
              )}
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            <div className="font-medium">Error</div>
            <div className="mt-1 text-red-200/90">{error}</div>
            <div className="mt-2 text-xs text-red-200/70">
              Tip: Is Supabase running locally? Is the Edge Function being served? Are VITE env vars correct?
            </div>
          </div>
        )}

        {!env.ok && !error && (
          <div className="mt-5 rounded-2xl border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200">
            <div className="font-medium">Missing setup</div>
            <div className="mt-1 text-amber-200/90">{env.message}</div>
            <div className="mt-2 text-xs text-amber-200/70">
              Then refresh the page (Vite reads env vars on startup).
            </div>
          </div>
        )}

        {data && (
          <section className="mt-6">
            <div className="mb-4 flex flex-col gap-1">
              <div className="text-sm text-zinc-300">
                <span className="font-medium text-zinc-100">{data.city}</span> •{" "}
                {Math.round(data.weather.tempC)}°C • {data.weather.condition} •{" "}
                {data.weather.windMps.toFixed(1)} m/s
                {data.weather.isRainy ? " • rain" : ""}
              </div>
            </div>

            <div className="grid gap-3">
              {data.recommendations.map((r, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-base font-semibold text-zinc-50">{r.title}</div>
                    <div className="flex items-center gap-2 text-xs">
                      {(() => {
                        const c = Math.max(0, Math.min(100, Math.round(r.confidence)));
                        const cls = confidenceClasses(c);
                        return (
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-1",
                                cls.pill,
                              ].join(" ")}
                              title="A rough 0–100 score for how well this fits today"
                            >
                              <span className="opacity-80">Confidence</span>
                              <span className="font-semibold tabular-nums">{c}</span>
                            </span>
                            <span className="h-2 w-16 overflow-hidden rounded-full bg-zinc-800">
                              <span
                                className={["block h-full", cls.bar].join(" ")}
                                style={{ width: `${c}%` }}
                              />
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-zinc-300">{r.reason}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-10" />
      </div>
    </div>
  );
}

export default App;
