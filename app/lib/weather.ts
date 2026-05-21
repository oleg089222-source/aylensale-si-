import type { WeatherStatus } from "./types";

export type WeekendForecast = {
  saturdayTemp: number;
  sundayTemp: number;
  saturdayRainPct: number;
  sundayRainPct: number;
  weatherStatus: WeatherStatus;
};

function rainFromCode(code: number): number {
  if (code >= 80) return 80;
  if (code >= 61) return 60;
  if (code >= 51) return 40;
  if (code >= 45) return 25;
  return 5;
}

function statusFromRain(satRain: number, sunRain: number): WeatherStatus {
  const max = Math.max(satRain, sunRain);
  if (max >= 50) return "BAD";
  if (max >= 25) return "OK";
  return "GOOD";
}

function nextSaturday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 6 ? 0 : day === 0 ? 6 : 6 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function fetchWeekendForecast(
  lat: number,
  lon: number
): Promise<WeekendForecast> {
  const start = nextSaturday();
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + 1);
  const end = endDate.toISOString().slice(0, 10);

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("daily", "temperature_2m_max,weathercode,precipitation_probability_max");
  url.searchParams.set("timezone", "Europe/London");
  url.searchParams.set("start_date", start);
  url.searchParams.set("end_date", end);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Weather API error");

  const data = await res.json();
  const daily = data.daily;
  const temps: number[] = daily?.temperature_2m_max ?? [12, 12];
  const codes: number[] = daily?.weathercode ?? [0, 0];
  const precip: number[] = daily?.precipitation_probability_max ?? [10, 10];

  const saturdayRain = Math.round(precip[0] ?? rainFromCode(codes[0] ?? 0));
  const sundayRain = Math.round(precip[1] ?? rainFromCode(codes[1] ?? 0));

  return {
    saturdayTemp: Math.round(temps[0] ?? 12),
    sundayTemp: Math.round(temps[1] ?? temps[0] ?? 12),
    saturdayRainPct: saturdayRain,
    sundayRainPct: sundayRain,
    weatherStatus: statusFromRain(saturdayRain, sundayRain),
  };
}

export async function geocodePostcode(postcode: string): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(postcode.trim().toUpperCase());
  const res = await fetch(`https://api.postcodes.io/postcodes/${q}`);
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.result;
  if (!result) return null;
  return { lat: result.latitude, lon: result.longitude };
}
