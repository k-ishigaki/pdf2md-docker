"use strict";

const { parentPort, workerData } = require("worker_threads");

function toErrorMessage(err) {
  if (!err) return "unknown error";
  if (typeof err === "string") return err;
  return err.message || String(err);
}

(async () => {
  const { buffer } = workerData;

  const unpdf = require("unpdf");
  const { definePDFJSModule } = unpdf;
  let pdfjsSource = "unpdf/pdfjs (default)";
  try {
    await definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.mjs"));
    pdfjsSource = "pdfjs-dist/legacy/build/pdf.mjs";
  } catch (e1) {
    try {
      await definePDFJSModule(() => import("pdfjs-dist/legacy/build/pdf.js"));
      pdfjsSource = "pdfjs-dist/legacy/build/pdf.js";
    } catch (e2) {
      try {
        await definePDFJSModule(() => import("pdfjs-dist"));
        pdfjsSource = "pdfjs-dist";
      } catch (e3) {
        throw new Error(
          `failed to load pdfjs-dist: ${e3 && e3.message ? e3.message : e3}`
        );
      }
    }
  }

  // eslint-disable-next-line no-console
  console.log(`worker pdfjs source: ${pdfjsSource}`);
  const originalGetDocumentProxy = unpdf.getDocumentProxy;
  unpdf.getDocumentProxy = (data, options = {}) =>
    originalGetDocumentProxy(data, { ...options, disableWorker: true });

  const pdf2md = await import("@opendocsg/pdf2md").then((mod) => {
    return mod && (mod.default || mod.pdf2md || mod);
  });

  const markdown = await pdf2md(Buffer.from(buffer));
  parentPort.postMessage({ ok: true, markdown });
})().catch((err) => {
  parentPort.postMessage({ ok: false, error: toErrorMessage(err) });
});
