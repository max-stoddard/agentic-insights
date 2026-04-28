import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CalibrationSnapshot } from "@agentic-insights/shared";
import { ensureDirSync, getCacheDir } from "./paths.js";

interface CalibrationFile {
  signature: string;
  snapshot: CalibrationSnapshot;
}

interface SignatureInput {
  pricingCatalogVersion: string;
  codexHome: string;
  claudeHome?: string;
  geminiHome?: string;
  codexHomeState: string;
  fileFingerprint: Array<{ path: string; mtimeMs: number; size: number }>;
}

function getCalibrationPath(): string {
  return path.join(getCacheDir(), "calibration.json");
}

export function buildSignature({
  pricingCatalogVersion,
  codexHome,
  claudeHome,
  geminiHome,
  codexHomeState,
  fileFingerprint
}: SignatureInput): string {
  return crypto
    .createHash("sha1")
    .update(
      JSON.stringify({
        pricingVersion: pricingCatalogVersion,
        codexHome,
        claudeHome,
        geminiHome,
        codexHomeState,
        files: fileFingerprint
      })
    )
    .digest("hex");
}

export function readCalibration(signature: string): CalibrationSnapshot | null {
  const calibrationPath = getCalibrationPath();
  if (!fs.existsSync(calibrationPath)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(calibrationPath, "utf8")) as CalibrationFile;
  return parsed.signature === signature ? parsed.snapshot : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    throw new Error("Cannot compute median of an empty array.");
  }

  if (sorted.length % 2 === 0) {
    const left = sorted[midpoint - 1];
    const right = sorted[midpoint];
    if (left === undefined || right === undefined) {
      throw new Error("Median bounds were unexpectedly undefined.");
    }
    return (left + right) / 2;
  }

  const center = sorted[midpoint];
  if (center === undefined) {
    throw new Error("Median center was unexpectedly undefined.");
  }
  return center;
}

export function writeCalibration(signature: string, snapshot: CalibrationSnapshot): void {
  ensureDirSync(getCacheDir());
  fs.writeFileSync(getCalibrationPath(), JSON.stringify({ signature, snapshot }, null, 2));
}

export function getOrCreateCalibration(signature: string, eventCosts: number[]): CalibrationSnapshot | null {
  const cached = readCalibration(signature);
  if (cached) {
    return cached;
  }

  if (eventCosts.length === 0) {
    return null;
  }

  const snapshot: CalibrationSnapshot = {
    referenceEventCostUsd: median(eventCosts),
    computedAt: Date.now(),
    supportedEventCount: eventCosts.length,
    supportedMedianSource: "local_median_event_cost_usd"
  };
  writeCalibration(signature, snapshot);
  return snapshot;
}
