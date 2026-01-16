type Mood = "chill" | "social" | "active" | "focus" | "surprise";
type Budget = "free" | "low" | "medium" | "high";
type PlacePref = "indoor" | "outdoor" | "either";

type RecommendRequest = {
  city: string;
  preferences?: {
    mood?: Mood;
    budget?: Budget;
    place?: PlacePref;
  };
};

type WeatherSnapshot = {
  provider: "openweather";
  city: string;
  tempC: number;
  windMps: number;
  condition: string;
  isRainy: boolean;
};

type Recommendation = {
  title: string;
  reason: string;
  label: "indoor" | "outdoor";
  confidence: number; // 0-100
};

type RecommendResponse = {
  city: string;
  weather: WeatherSnapshot;
  recommendations: Recommendation[];
};

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function fetchOpenWeather(city: string, apiKey: string): Promise<WeatherSnapshot> {
  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", city);
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Weather API error (${res.status}): ${text || res.statusText}`);
  }
  const data = await res.json();

  const tempC = Number(data?.main?.temp);
  const windMps = Number(data?.wind?.speed);
  const condition = String(data?.weather?.[0]?.main || data?.weather?.[0]?.description || "unknown");
  const isRainy =
    Boolean(data?.rain && (data?.rain["1h"] || data?.rain["3h"])) ||
    /rain|drizzle|storm|thunder/i.test(condition);

  if (!Number.isFinite(tempC) || !Number.isFinite(windMps)) {
    throw new Error("Weather API returned unexpected data shape.");
  }

  return {
    provider: "openweather",
    city,
    tempC,
    windMps,
    condition,
    isRainy,
  };
}

function ruleHintsFromWeather(w: WeatherSnapshot) {
  const tooCold = w.tempC < 8;
  const tooHot = w.tempC > 32;
  const tooWindy = w.windMps > 10;
  const preferIndoor = w.isRainy || tooCold || tooHot || tooWindy;

  const notes: string[] = [];
  if (w.isRainy) notes.push("Yağış var: dış mekân önerilerini azalt.");
  if (tooCold) notes.push("Soğuk: uzun outdoor aktiviteleri azalt.");
  if (tooHot) notes.push("Sıcak: gölge/klimalı seçenekleri artır.");
  if (tooWindy) notes.push("Rüzgarlı: yürüyüş/park yerine indoor ağırlık ver.");

  return { preferIndoor, notes, flags: { tooCold, tooHot, tooWindy } };
}

function fallbackRecommendations(w: WeatherSnapshot, place: PlacePref | undefined): Recommendation[] {
  const { preferIndoor } = ruleHintsFromWeather(w);
  // Keep it simple:
  // - If weather strongly suggests indoor, we bias to indoor even if user picked "outdoor".
  // - If user picked "outdoor", we still include a few safer outdoor options, but with lower confidence.
  const userTarget = place && place !== "either" ? place : null;
  const target = preferIndoor ? "indoor" : userTarget ?? "outdoor";

  const indoor: Recommendation[] = [
    { title: "Coffee + a book", reason: "Low effort, cozy, and weather-proof.", label: "indoor", confidence: 74 },
    { title: "Museum / gallery visit", reason: "A solid 1–2 hour plan that doesn’t depend on the weather.", label: "indoor", confidence: 70 },
    { title: "Cinema or a small event", reason: "One of the safest picks when it’s rainy or windy.", label: "indoor", confidence: 68 },
    { title: "Gym / short home workout", reason: "If you want something active in a controlled environment.", label: "indoor", confidence: 66 },
    { title: "Try a new recipe", reason: "A fun low-budget option you can do at home.", label: "indoor", confidence: 62 },
  ];

  const outdoor: Recommendation[] = [
    { title: "Short walk + photos", reason: "If the weather is okay, it’s the simplest plan that feels good.", label: "outdoor", confidence: 74 },
    { title: "Park coffee break", reason: "Keep it short to keep the risk low.", label: "outdoor", confidence: 70 },
    { title: "Bike ride / waterfront loop", reason: "Great energy boost if the wind is not too strong.", label: "outdoor", confidence: 66 },
    { title: "Neighborhood walk (new route)", reason: "Keep the scope small: 60–90 minutes.", label: "outdoor", confidence: 64 },
    { title: "Market run + a small detour", reason: "Practical + a bit of fresh air.", label: "outdoor", confidence: 60 },
  ];

  const base = (target === "indoor" ? indoor : outdoor).map((r) => ({
    ...r,
    confidence: clampInt(r.confidence, 0, 100),
  }));

  // If user explicitly wants outdoor but weather suggests indoor, include 2 safer outdoor ideas with lower confidence.
  if (preferIndoor && userTarget === "outdoor") {
    const safetyNote = w.isRainy
      ? "It’s rainy—bring a jacket/umbrella and keep it short."
      : "Weather is not ideal—keep it short and flexible.";
    const extras: Recommendation[] = [
      { title: "Quick errand walk", reason: safetyNote, label: "outdoor", confidence: 45 },
      { title: "Short café hop nearby", reason: safetyNote, label: "outdoor", confidence: 42 },
    ];
    return [...base, ...extras].slice(0, 7);
  }

  return base;
}

async function callOpenAI(args: {
  apiKey: string;
  model: string;
  req: RecommendRequest;
  weather: WeatherSnapshot;
}): Promise<Recommendation[]> {
  const { notes, preferIndoor } = ruleHintsFromWeather(args.weather);
  const place = args.req.preferences?.place ?? "either";
  const mood = args.req.preferences?.mood ?? "chill";
  const budget = args.req.preferences?.budget ?? "low";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      recommendations: {
        type: "array",
        minItems: 5,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 2, maxLength: 60 },
            reason: { type: "string", minLength: 10, maxLength: 140 },
            label: { type: "string", enum: ["indoor", "outdoor"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["title", "reason", "label", "confidence"],
        },
      },
    },
    required: ["recommendations"],
  } as const;

  const system = [
    "You are a day-planning assistant for city life.",
    "Goal: Based on the weather, return 5–8 short activity ideas with a short reason.",
    "Constraints:",
    "- Write in ENGLISH.",
    "- No fluff. Be clear and practical.",
    "- If the weather is bad, prefer indoor suggestions.",
    "- Output MUST be valid JSON matching the schema (no extra text).",
  ].join("\n");

  const user = {
    city: args.req.city,
    preferences: { mood, budget, place },
    weather: args.weather,
    rules: { preferIndoor, notes },
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
      // NOTE: The Responses API moved "response_format" under "text.format".
      // We keep a strict JSON schema so the UI can rely on shape.
      text: {
        format: {
          type: "json_schema",
          json_schema: { name: "planbyweather_recommendations", schema, strict: true },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error (${res.status}): ${text || res.statusText}`);
  }

  const data = await res.json();
  const text =
    typeof data?.output_text === "string"
      ? data.output_text
      : data?.output?.[0]?.content?.[0]?.text;

  if (typeof text !== "string") {
    throw new Error("OpenAI response did not contain JSON text.");
  }

  const parsed = JSON.parse(text);
  const recs = parsed?.recommendations;
  if (!Array.isArray(recs)) throw new Error("OpenAI JSON missing recommendations array.");

  return recs.map((r: any) => ({
    title: String(r.title ?? "").slice(0, 60),
    reason: String(r.reason ?? "").slice(0, 140),
    label: r.label === "outdoor" ? "outdoor" : "indoor",
    confidence: clampInt(Number(r.confidence ?? 50), 0, 100),
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed. Use POST." });

  let body: RecommendRequest;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body." });
  }

  const city = String(body?.city || "").trim();
  if (!city) return json(400, { error: "city is required." });

  const weatherKey = Deno.env.get("WEATHER_API_KEY") ?? "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const openaiModel = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

  if (!weatherKey) {
    return json(500, { error: "Missing WEATHER_API_KEY on the server (Edge Function env)." });
  }

  try {
    console.log("[recommend] request", { city, preferences: body.preferences ?? null });

    const weather = await fetchOpenWeather(city, weatherKey);
    console.log("[recommend] weather", weather);

    let recommendations: Recommendation[];
    if (openaiKey) {
      try {
        recommendations = await callOpenAI({
          apiKey: openaiKey,
          model: openaiModel,
          req: { city, preferences: body.preferences },
          weather,
        });
        console.log("[recommend] openai recommendations", recommendations.length);
      } catch (err) {
        console.warn("[recommend] openai failed, falling back", err);
        recommendations = fallbackRecommendations(weather, body.preferences?.place);
        console.log("[recommend] fallback recommendations", recommendations.length);
      }
    } else {
      recommendations = fallbackRecommendations(weather, body.preferences?.place);
      console.log("[recommend] fallback recommendations", recommendations.length);
    }

    const resp: RecommendResponse = { city, weather, recommendations };
    return json(200, resp);
  } catch (err) {
    console.error("[recommend] error", err);
    return json(500, { error: err instanceof Error ? err.message : "Unknown error" });
  }
});


