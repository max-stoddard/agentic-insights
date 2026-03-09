import type { MethodologyResponse, OverviewResponse, TimeseriesResponse } from "@ai-water-usage/shared";

async function getJson<T>(input: string): Promise<T> {
  const response = await fetch(input);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchOverview(timeZone: string): Promise<OverviewResponse> {
  return getJson(`/api/overview?tz=${encodeURIComponent(timeZone)}`);
}

export function fetchTimeseries(bucket: "day" | "week" | "month", timeZone: string): Promise<TimeseriesResponse> {
  return getJson(`/api/timeseries?bucket=${bucket}&tz=${encodeURIComponent(timeZone)}`);
}

export function fetchMethodology(): Promise<MethodologyResponse> {
  return getJson("/api/methodology");
}
