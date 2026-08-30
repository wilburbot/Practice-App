import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { authRouter } from "./routes/auth.js";
import { teamsRouter } from "./routes/teams.js";
import { playersRouter } from "./routes/players.js";
import { sessionsRouter } from "./routes/sessions.js";
import { statsRouter } from "./routes/stats.js";
import { reportsRouter } from "./routes/reports.js";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/teams", teamsRouter);
app.use("/players", playersRouter);
app.use("/sessions", sessionsRouter);
app.use("/stats", statsRouter);
app.use("/reports", reportsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Volleyball API listening on http://localhost:${port}`);
});
