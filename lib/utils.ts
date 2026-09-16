/**
 * lib/utils.ts
 * General utility functions shared across the app.
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names — handles conditional classes and overrides. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Copy text to clipboard — returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Sleep for n milliseconds. */
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Type-guard: is a value a non-null object. */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
