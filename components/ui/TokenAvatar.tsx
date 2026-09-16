"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface TokenAvatarProps {
  logoUri?: string | null;
  symbol: string;
  size?: number; // size in px, default 24
  className?: string;
}

// Deterministic subtle colors for fallback tokens
const FALLBACK_COLORS = [
  "bg-accent/20 text-accent border-accent/30",
  "bg-secondary/20 text-secondary border-secondary/30",
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
];

const IPFS_GATEWAYS = [
  "https://ipfs.filebase.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "/api/token-image?ipfs=",
  "https://flk-ipfs.xyz/ipfs/",
  "https://ipfs.io/ipfs/",
];

// Global in-memory cache so once a token logo URL is resolved, all components share it instantly
const RESOLVED_LOGO_CACHE = new Map<string, string>();

function extractIpfsPath(url: string): string | null {
  if (url.startsWith("ipfs://")) return url.slice(7);
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+(?:\/[^?#\s]*)?)/);
  return match ? match[1] : null;
}

function preloadImage(url: string, timeoutMs = 3500): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise((resolve) => {
    const img = new window.Image();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        img.src = "";
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(false);
      }
    };

    img.src = url;
  });
}

export function TokenAvatar({
  logoUri,
  symbol,
  size = 24,
  className,
}: TokenAvatarProps) {
  // Check if COOK
  const isCook = symbol?.toUpperCase() === "COOK";
  const effectiveUri = isCook ? "/cook.jpeg" : logoUri;

  const [loadedSrc, setLoadedSrc] = useState<string | null>(() => {
    if (!effectiveUri) return null;
    return RESOLVED_LOGO_CACHE.get(effectiveUri) || null;
  });

  const [isReady, setIsReady] = useState<boolean>(() => {
    if (!effectiveUri) return false;
    return RESOLVED_LOGO_CACHE.has(effectiveUri);
  });

  useEffect(() => {
    if (!effectiveUri) {
      setLoadedSrc(null);
      setIsReady(false);
      return;
    }

    // Check memory cache first
    const cached = RESOLVED_LOGO_CACHE.get(effectiveUri);
    if (cached) {
      setLoadedSrc(cached);
      setIsReady(true);
      return;
    }

    let isMounted = true;

    async function resolveLogo() {
      // Local asset (starts with /)
      if (effectiveUri!.startsWith("/")) {
        const ok = await preloadImage(effectiveUri!, 2000);
        if (ok && isMounted) {
          RESOLVED_LOGO_CACHE.set(effectiveUri!, effectiveUri!);
          setLoadedSrc(effectiveUri!);
          setIsReady(true);
        }
        return;
      }

      const ipfsPath = extractIpfsPath(effectiveUri!);
      const candidates: string[] = [];

      if (ipfsPath) {
        // Build list of gateway candidates
        for (const gw of IPFS_GATEWAYS) {
          candidates.push(`${gw}${ipfsPath}`);
        }
      } else if (effectiveUri!.startsWith("http")) {
        candidates.push(effectiveUri!);
        candidates.push(`/api/token-image?url=${encodeURIComponent(effectiveUri!)}`);
      }

      // Progressively test candidates in background
      for (const candidate of candidates) {
        if (!isMounted) return;
        const ok = await preloadImage(candidate, 3000);
        if (ok && isMounted) {
          RESOLVED_LOGO_CACHE.set(effectiveUri!, candidate);
          setLoadedSrc(candidate);
          setIsReady(true);
          return;
        }
      }
    }

    resolveLogo();

    return () => {
      isMounted = false;
    };
  }, [effectiveUri]);

  // Color index based on symbol string for instant fallback
  const colorIndex = Math.abs(
    (symbol || "??")
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % FALLBACK_COLORS.length;

  const colorClass = FALLBACK_COLORS[colorIndex];
  const initials = (symbol || "??").slice(0, 2).toUpperCase();

  return (
    <div
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      className={cn(
        "relative rounded-full flex items-center justify-center flex-shrink-0 select-none overflow-hidden",
        className
      )}
    >
      {/* ─── 1. Instant Fallback Badge (Shows immediately on frame 1) ─── */}
      <div
        className={cn(
          "w-full h-full rounded-full border flex items-center justify-center font-bold font-mono",
          colorClass,
          size <= 20 ? "text-[9px]" : size <= 28 ? "text-[10px]" : "text-xs"
        )}
      >
        {initials}
      </div>

      {/* ─── 2. Progressive Logo (Fades in ONLY after background preload succeeds) ─── */}
      {isReady && loadedSrc && (
        <img
          src={loadedSrc}
          alt={symbol}
          style={{ width: size, height: size }}
          className="absolute inset-0 w-full h-full rounded-full object-cover bg-bg-card transition-opacity duration-200 opacity-100 select-none"
          loading="lazy"
        />
      )}
    </div>
  );
}
