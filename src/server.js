"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const { Worker } = require("worker_threads");

const app = express();
app.disable("x-powered-by");

const PORT = parseInt(process.env.PORT || "8080", 10);
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "20", 10);
const CONVERT_TIMEOUT_MS = parseInt(
  process.env.CONVERT_TIMEOUT_MS || "300000",
  10
); // default 5 minutes

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
});

function convertPdf(buffer, timeoutMs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "convert-worker.js"), {
      workerData: { buffer },
    });

    const timeoutId = setTimeout(() => {
      worker
        .terminate()
        .then(() => reject(new Error("convert timeout")))
        .catch(() => reject(new Error("convert timeout")));
    }, timeoutMs);

    worker.on("message", (msg) => {
      clearTimeout(timeoutId);
      if (msg && msg.ok) {
        resolve(msg.markdown);
      } else {
        reject(new Error((msg && msg.error) || "convert failed"));
      }
    });

    worker.on("error", (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timeoutId);
        reject(new Error(`worker exit ${code}`));
      }
    });
  });
}

app.get("/healthz", (req, res) => {
  res.json({ ok: true });
});

app.post("/convert", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "file フィールドに PDF を指定してください" });
    }

    const name = req.file.originalname || "input.pdf";
    const sizeMb = (req.file.size / (1024 * 1024)).toFixed(2);
    // eslint-disable-next-line no-console
    console.log(`convert start: ${name} (${sizeMb}MB)`);
    const isPdf =
      req.file.mimetype === "application/pdf" ||
      name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return res.status(400).json({ error: "PDF ファイルのみ対応しています" });
    }

    const startedAt = Date.now();
    const markdown = await convertPdf(req.file.buffer, CONVERT_TIMEOUT_MS);
    const elapsedMs = Date.now() - startedAt;
    // eslint-disable-next-line no-console
    console.log(`convert done: ${name} (${elapsedMs}ms)`);

    if (req.query.format === "raw") {
      return res.type("text/markdown; charset=utf-8").send(markdown);
    }

    return res.json({ filename: name, markdown });
  } catch (err) {
    return next(err);
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `ファイルサイズが上限(${MAX_FILE_SIZE_MB}MB)を超えています`,
    });
  }

  if (err && err.message === "convert timeout") {
    return res.status(504).json({ error: "変換がタイムアウトしました" });
  }

  // eslint-disable-next-line no-console
  console.error("conversion error:", err);
  return res.status(500).json({ error: "変換に失敗しました" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`pdf2md API listening on ${PORT}`);
});
