export type Mood = "chill" | "social" | "active" | "focus" | "surprise";
export type Budget = "free" | "low" | "medium" | "high";
export type PlacePref = "indoor" | "outdoor" | "either";

export type RecommendRequest = {
  city: string;
  preferences?: {
    mood?: Mood;
    budget?: Budget;
    place?: PlacePref;
  };
};

export type WeatherSnapshot = {
  provider: "openweather";
  city: string;
  tempC: number;
  windMps: number;
  condition: string;
  isRainy: boolean;
};

export type Recommendation = {
  title: string;
  reason: string;
  label: "indoor" | "outdoor";
  confidence: number;
};

export type RecommendResponse = {
  city: string;
  weather: WeatherSnapshot;
  recommendations: Recommendation[];
};


