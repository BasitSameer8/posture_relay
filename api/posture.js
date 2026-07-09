// api/posture.js
// Sits next to your existing api/send.js in the same Vercel project.
//
// Setup (one-time):
//   1. Create a free Redis database at https://upstash.com
//   2. In your Vercel project settings, add env vars:
//        UPSTASH_REDIS_REST_URL
//        UPSTASH_REDIS_REST_TOKEN
//      (Upstash gives you both when you create the database)
//   3. npm install @upstash/redis   (in your project root)

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const HISTORY_KEY = "posture:history";
const MAX_HISTORY = 100;

export default async function handler(req, res) {
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

  if (req.method === "GET") {
    try {
      const latest = (await redis.get("posture:latest")) ?? null;
      const rawHistory = (await redis.lrange(HISTORY_KEY, 0, MAX_HISTORY - 1)) ?? [];
      const history = rawHistory
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

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end(`Method ${req.method} not allowed`);
}