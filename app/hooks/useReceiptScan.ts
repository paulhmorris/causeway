import { useCallback, useRef, useState } from "react";

import { parseReceiptText, type ParsedReceipt } from "~/lib/receipt-ocr";

export type ScanStatus = "idle" | "scanning" | "done" | "error";

export type ScanState = {
  status: ScanStatus;
  /** Recognition progress, 0–1, while status is "scanning". */
  progress: number;
  result: ParsedReceipt | null;
  error: string | null;
};

const INITIAL: ScanState = { status: "idle", progress: 0, result: null, error: null };

/**
 * Run OCR on a receipt image entirely in the browser via Tesseract.js, then
 * parse the recognized text into expense-line fields.
 *
 * Tesseract.js is imported lazily inside `scan` so it never loads during SSR
 * and doesn't weigh down the initial bundle — the ~2MB worker, WASM core, and
 * English model are fetched (and cached by the browser) only when someone
 * actually scans a receipt. All compute happens on the user's device, so there
 * is no server cost and no external OCR API.
 */
export function useReceiptScan() {
  const [state, setState] = useState<ScanState>(INITIAL);
  // Guards against overlapping scans if the button is double-triggered.
  const runningRef = useRef(false);

  const reset = useCallback(() => setState(INITIAL), []);

  const scan = useCallback(async (file: File): Promise<ParsedReceipt | null> => {
    if (runningRef.current) return null;
    runningRef.current = true;
    setState({ status: "scanning", progress: 0, result: null, error: null });

    try {
      const { default: Tesseract } = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setState((s) => ({ ...s, progress: message.progress }));
          }
        },
      });

      const result = parseReceiptText(data.text);
      setState({ status: "done", progress: 1, result, error: null });
      return result;
    } catch {
      setState({
        status: "error",
        progress: 0,
        result: null,
        error: "Couldn't read that image. Enter the details by hand.",
      });
      return null;
    } finally {
      runningRef.current = false;
    }
  }, []);

  return { ...state, scan, reset };
}
