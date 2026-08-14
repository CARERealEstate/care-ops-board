import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "dist");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(compression());

// Hashed build assets are immutable — cache them hard.
app.use(
  "/assets",
  express.static(path.join(dist, "assets"), {
    immutable: true,
    maxAge: "1y",
  })
);

// The service worker must never be served stale, or updates never land.
app.get("/sw.js", (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.type("application/javascript");
  res.sendFile(path.join(dist, "sw.js"));
});

app.use(
  express.static(dist, {
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

app.get("/healthz", (req, res) => res.json({ ok: true }));

// SPA fallback
app.get("*", (req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CARE Ops Board listening on :${PORT}`);
});
