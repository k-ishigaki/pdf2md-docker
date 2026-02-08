"use strict";

function buildMinimalPdf() {
  const parts = [];
  const offsets = [0];

  function push(str) {
    parts.push(str);
  }

  function addObject(objStr) {
    offsets.push(Buffer.byteLength(parts.join("")));
    push(objStr);
  }

  push("%PDF-1.4\n");

  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addObject(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  addObject(
    "4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 24 Tf\n72 72 Td\n(Hello) Tj\nET\nendstream\nendobj\n"
  );
  addObject(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  );

  const xrefOffset = Buffer.byteLength(parts.join(""));

  push("xref\n0 6\n");
  push("0000000000 65535 f \n");
  for (let i = 1; i <= 5; i += 1) {
    const off = String(offsets[i]).padStart(10, "0");
    push(`${off} 00000 n \n`);
  }

  push("trailer\n<< /Size 6 /Root 1 0 R >>\n");
  push(`startxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(parts.join(""), "binary");
}

async function main() {
  const unpdf = require("unpdf");
  const { definePDFJSModule } = unpdf;
  try {
    await definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
  } catch (e1) {
    try {
      await definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.js"));
    } catch (e2) {
      await definePDFJSModule(() => import("pdfjs-dist"));
    }
  }

  const originalGetDocumentProxy = unpdf.getDocumentProxy;
  unpdf.getDocumentProxy = (data, options = {}) =>
    originalGetDocumentProxy(data, { ...options, disableWorker: true });

  const pdf2md = await import("@opendocsg/pdf2md").then((mod) => {
    return mod && (mod.default || mod.pdf2md || mod);
  });

  const buffer = buildMinimalPdf();
  const timeoutMs = 15000;

  const markdown = await Promise.race([
    pdf2md(buffer),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("selftest timeout")), timeoutMs)
    ),
  ]);

  const snippet = String(markdown).slice(0, 200).replace(/\s+/g, " ");
  // eslint-disable-next-line no-console
  console.log("selftest ok, snippet:", snippet);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("selftest failed:", err && err.message ? err.message : err);
  process.exit(1);
});
