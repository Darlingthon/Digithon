// Base URL of the Channels service (Twilio SMS/OTP + Vera voice). Empty when not
// configured — callers then fall back to in-process Brain actions (demo mode).
export function channelsUrl(): string {
  return (process.env.CHANNELS_URL ?? "").replace(/\/$/, "");
}

export async function channelsPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const base = channelsUrl();
  if (!base) throw new Error("CHANNELS_URL is not set — start the channels service and set CHANNELS_URL");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`channels ${path} -> ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}
