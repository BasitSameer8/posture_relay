import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const HISTORY_KEY = "posture:history";
const MAX_HISTORY = 100;

export default async function handler(req, res) {
  // 1. Set global CORS headers immediately before any logic runs
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 2. Handle browser preflight checks instantly
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 3. Handle data incoming from ESP32 or the simulator
  if (req.method === "POST") {
    try {
      const { deviation, slouching } = req.body ?? {};

      if (typeof deviation !== "number" || typeof slouching !== "boolean") {
        return res.status(400).json({ error: "deviation (number) and slouching (bool) required" });
      }

      const reading = { deviation, slouching, timestamp: Date.now() };

      await redis.set("posture:latest", reading);
      await redis.lpush(HISTORY_KEY, JSON.stringify(reading));
      await redis.ltrim(HISTORY_KEY, 0, MAX_HISTORY - 1);

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("POST /api/posture failed:", err);
      return res.status(500).json({ error: "Failed to store posture data", detail: String(err) });
    }
  }

  // 4. Handle data requested by your index.html frontend dashboard
  if (req.method === "GET") {
    try {
      const latest = (await redis.get("posture:latest")) ?? null;
      const rawHistory = (await redis.lrange(HISTORY_KEY, 0, MAX_HISTORY - 1)) ?? [];
      
      // Safety step: ensure history parses gracefully even if database was empty
      const safeHistory = Array.isArray(rawHistory) ? rawHistory : [];

      const history = safeHistory
        .map((r) => {
          try {
            return typeof r === "string" ? JSON.parse(r) : r;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse();

      return res.status(200).json({ latest, history });
    } catch (err) {
      console.error("GET /api/posture failed:", err);
      return res.status(500).json({ error: "Failed to read posture data", detail: String(err) });
    }
  }

  // 5. Catch unsupported methods
  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} not allowed`);
}