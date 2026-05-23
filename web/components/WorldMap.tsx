"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
  Marker,
} from "react-simple-maps";
import { feature } from "topojson-client";
import { useGameStore } from "@/store/gameStore";
import { useT } from "@/lib/i18n/useT";
import type { CountryMeta } from "@/types/shared";

// Higher-detail world topojson (50m) so small countries are actually visible.
const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

// Micro / island states that are absent (or sub-pixel) even at 50m — used to
// drop a locator pin so the player can still find them.
const MICRO_COORDS: Record<string, [number, number]> = {
  VA: [12.45, 41.9], MC: [7.42, 43.74], SM: [12.46, 43.94], LI: [9.55, 47.16], AD: [1.52, 42.51],
  MT: [14.4, 35.9], SG: [103.82, 1.35], BH: [50.56, 26.07], MV: [73.5, 4.18], MU: [57.55, -20.28],
  SC: [55.49, -4.68], KM: [43.33, -11.65], CV: [-23.6, 16.0], ST: [6.61, 0.25],
  MH: [171.18, 7.13], FM: [158.2, 6.92], PW: [134.58, 7.5], KI: [173.0, 1.87], NR: [166.93, -0.52],
  TV: [179.2, -8.52], TO: [-175.2, -21.18], WS: [-172.1, -13.76],
  AG: [-61.8, 17.06], BB: [-59.54, 13.19], DM: [-61.37, 15.41], GD: [-61.68, 12.12],
  KN: [-62.73, 17.36], LC: [-60.98, 13.91], VC: [-61.2, 13.25], TT: [-61.22, 10.69], BN: [114.7, 4.5],
};

// Pavillon · Apple-soft map palette.
const SEA = "#faf7f0";
const LAND = "#eae5da";
const LAND_HOVER = "#dcd6c8";
const STROKE = "rgba(28,28,30,0.12)";
const ACCENT = "#d4541c";
const LABEL = "rgba(28,28,30,.40)";

// Projection sized so the world fills the SVG viewBox (no big empty margins).
const VB_W = 800;
const VB_H = 400;
const SCALE = 300;
const DEFAULT_VIEW: View = { center: [0, 0], zoom: 1 };

const CONTINENT_LABELS: { coords: [number, number]; fr: string; en: string }[] = [
  { coords: [-100, 48], fr: "AMÉRIQUE DU NORD", en: "NORTH AMERICA" },
  { coords: [-58, -15], fr: "AMÉRIQUE DU SUD", en: "SOUTH AMERICA" },
  { coords: [16, 53], fr: "EUROPE", en: "EUROPE" },
  { coords: [20, 7], fr: "AFRIQUE", en: "AFRICA" },
  { coords: [90, 50], fr: "ASIE", en: "ASIA" },
  { coords: [140, -25], fr: "OCÉANIE", en: "OCEANIA" },
];

interface View {
  center: [number, number];
  zoom: number;
}

interface Focus extends View {
  span: number; // largest bounding-box extent in degrees
}

interface Props {
  countries: CountryMeta[]; // delivered from /api/countries
  highlightIso?: string | null; // mystery-mode target → auto-zoom
  interactive?: boolean; // hover during play
  showLabels?: boolean; // continent labels
  onHover?: (isoCode: string | null) => void;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Geographic centre + a sensible zoom level to frame a country, derived from
 * its bounding box. Antimeridian-spanning countries (Russia, Fiji…) are
 * unwrapped so they don't centre on 0°.
 */
function focusFromGeometry(geom: any): Focus {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  let minLonS = Infinity, maxLonS = -Infinity; // longitudes shifted to [0,360)
  const visit = (c: any) => {
    if (typeof c[0] === "number") {
      const x = c[0], y = c[1];
      if (x < minLon) minLon = x;
      if (x > maxLon) maxLon = x;
      if (y < minLat) minLat = y;
      if (y > maxLat) maxLat = y;
      const xs = x < 0 ? x + 360 : x;
      if (xs < minLonS) minLonS = xs;
      if (xs > maxLonS) maxLonS = xs;
    } else {
      for (const cc of c) visit(cc);
    }
  };
  if (geom?.coordinates) visit(geom.coordinates);

  const wraps = maxLon - minLon > 180;
  let centerLon = (minLon + maxLon) / 2;
  let lonSpan = maxLon - minLon;
  if (wraps) {
    centerLon = (minLonS + maxLonS) / 2;
    if (centerLon > 180) centerLon -= 360;
    lonSpan = maxLonS - minLonS;
  }
  const centerLat = (minLat + maxLat) / 2;
  const latSpan = maxLat - minLat;
  const span = Math.max(lonSpan, latSpan); // raw extent (°) — for "tiny" detection
  const sizeForZoom = Math.max(lonSpan, latSpan * 1.6, 4);
  const zoom = clamp(40 / sizeForZoom, 1.5, 2.7); // gentle framing, keeps context
  return { center: [centerLon, centerLat], zoom, span };
}

export default function WorldMap({
  countries,
  highlightIso,
  interactive = true,
  showLabels = true,
  onHover,
}: Props) {
  const state = useGameStore((s) => s.state);
  const lastConquest = useGameStore((s) => s.lastConquest);
  const { lang } = useT();

  // Fetch + parse the topojson once; derive both the geographies and a
  // per-country focus map (used to auto-zoom onto the mystery target).
  const [geoData, setGeoData] = useState<any>(null);
  const focusRef = useRef<Map<string, Focus>>(new Map());
  useEffect(() => {
    let cancelled = false;
    fetch(TOPO_URL)
      .then((r) => r.json())
      .then((topo) => {
        if (cancelled) return;
        const fc: any = feature(topo, topo.objects.countries);
        const m = new Map<string, Focus>();
        for (const f of fc.features) {
          m.set(String(f.id).padStart(3, "0"), focusFromGeometry(f.geometry));
        }
        focusRef.current = m;
        setGeoData(fc);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const byNumeric = useMemo(() => {
    const m = new Map<string, CountryMeta>();
    for (const c of countries) m.set(c.numericId, c);
    return m;
  }, [countries]);

  const numericByIso = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countries) m.set(c.isoCode, c.numericId);
    return m;
  }, [countries]);

  // ISO -> player color
  const colorByIso = useMemo(() => {
    const m = new Map<string, string>();
    if (!state) return m;
    const playerColor = new Map(state.players.map((p) => [p.id, p.color]));
    for (const c of state.conquered) {
      const col = playerColor.get(c.playerId);
      if (col) m.set(c.isoCode, col);
    }
    return m;
  }, [state]);

  // Transient "just captured" glow — fades ~850ms after each conquest.
  const [glowIso, setGlowIso] = useState<string | null>(null);
  useEffect(() => {
    if (!lastConquest) return;
    setGlowIso(lastConquest.isoCode);
    const t = setTimeout(() => setGlowIso(null), 850);
    return () => clearTimeout(t);
  }, [lastConquest]);

  // Auto-zoom onto the highlighted (mystery) country, reset to world otherwise.
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  useEffect(() => {
    if (highlightIso && geoData) {
      const nid = numericByIso.get(highlightIso);
      const f = nid ? focusRef.current.get(nid) : undefined;
      if (f) { setView({ center: f.center, zoom: f.zoom }); return; }
      const micro = MICRO_COORDS[highlightIso];
      if (micro) { setView({ center: micro, zoom: 2.6 }); return; }
    }
    setView(DEFAULT_VIEW);
  }, [highlightIso, geoData, numericByIso]);

  const zoomedIn = view.zoom > 1.4;

  // Locator pin for the highlighted (mystery) country when it's tiny or missing
  // from the topojson — so e.g. Vatican / Monaco / Nauru can still be found.
  const hiNumeric = highlightIso ? numericByIso.get(highlightIso) : undefined;
  const hiFocus = hiNumeric ? focusRef.current.get(hiNumeric) : undefined;
  const pinPos: [number, number] | null =
    hiFocus?.center ?? (highlightIso ? MICRO_COORDS[highlightIso] ?? null : null);
  const tinyCountry = hiFocus ? hiFocus.span < 2.5 : true; // absent → treat as tiny
  const showPin = !!highlightIso && !!pinPos && tinyCountry;

  return (
    <div className="relative w-full h-full" style={{ background: SEA }}>
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: SCALE, center: [0, 0] }}
        width={VB_W}
        height={VB_H}
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <filter id="cap-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <ZoomableGroup
          center={view.center}
          zoom={view.zoom}
          minZoom={1}
          maxZoom={8}
          filterZoomEvent={() => false}
        >
          {geoData && (
            <Geographies geography={geoData}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const numericId = String(geo.id).padStart(3, "0");
                  const meta = byNumeric.get(numericId);
                  const iso = meta?.isoCode;
                  const conqueredColor = iso ? colorByIso.get(iso) : undefined;
                  const isHighlight = !!iso && !!highlightIso && iso === highlightIso;
                  const isGlow = !!iso && iso === glowIso;
                  const fill = conqueredColor ?? (isHighlight ? ACCENT : LAND);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => {
                        if (!interactive || !iso) return;
                        onHover?.(iso);
                      }}
                      onMouseLeave={() => {
                        if (!interactive) return;
                        onHover?.(null);
                      }}
                      filter={isHighlight || isGlow ? "url(#cap-glow)" : undefined}
                      style={{
                        default: {
                          fill,
                          stroke: isHighlight ? ACCENT : STROKE,
                          strokeWidth: isHighlight ? 1.1 : 0.5,
                          strokeLinejoin: "round",
                          outline: "none",
                          transition: "fill .35s cubic-bezier(.2,.7,.3,1), stroke .2s",
                        },
                        hover: {
                          fill: conqueredColor ?? (isHighlight ? ACCENT : LAND_HOVER),
                          stroke: STROKE,
                          strokeWidth: 0.7,
                          outline: "none",
                          cursor: interactive && iso ? "crosshair" : "default",
                        },
                        pressed: { fill: conqueredColor ?? LAND_HOVER, outline: "none" },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          )}

          {showLabels && !zoomedIn &&
            CONTINENT_LABELS.map((l) => (
              <Marker key={l.fr} coordinates={l.coords}>
                <text
                  textAnchor="middle"
                  className="font-mono"
                  style={{
                    fill: LABEL,
                    fontSize: 7,
                    letterSpacing: 1.5,
                    fontWeight: 500,
                    pointerEvents: "none",
                  }}
                >
                  {l[lang]}
                </text>
              </Marker>
            ))}
          {showPin && pinPos && (
            <Marker coordinates={pinPos}>
              <g transform={`scale(${1 / view.zoom})`} style={{ pointerEvents: "none" }}>
                <circle r={7} fill={ACCENT} opacity={0.18} className="wm-pin-pulse" />
                <circle r={4.5} fill="none" stroke={ACCENT} strokeWidth={1.4} />
                <circle r={1.6} fill={ACCENT} />
                <path d="M0 -9 L-4.5 -18 L4.5 -18 Z" fill={ACCENT} />
              </g>
            </Marker>
          )}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
}
