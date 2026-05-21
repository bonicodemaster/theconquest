"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { formatArea } from "@/lib/format";

// Public, lightweight world topojson (countries with numeric ISO ids).
const TOPO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface CountryMeta {
  isoCode: string;
  numericId: string;
  name: string;
  capital: string;
  continent: string;
  areaKm2: number;
}

interface Props {
  countries: CountryMeta[];           // delivered from /api/countries
  highlightIso?: string | null;       // mystery-mode target
  interactive?: boolean;              // tooltips/hover during play
}

export default function WorldMap({ countries, highlightIso, interactive = true }: Props) {
  const state = useGameStore((s) => s.state);
  const lastConquest = useGameStore((s) => s.lastConquest);

  const byNumeric = useMemo(() => {
    const m = new Map<string, CountryMeta>();
    for (const c of countries) m.set(c.numericId, c);
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

  const [hover, setHover] = useState<{ x: number; y: number; meta: CountryMeta } | null>(null);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden glass">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 165 }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup zoom={1} center={[10, 10]} maxZoom={6}>
          <Geographies geography={TOPO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const numericId = String(geo.id).padStart(3, "0");
                const meta = byNumeric.get(numericId);
                const iso = meta?.isoCode;
                const conqueredColor = iso ? colorByIso.get(iso) : undefined;
                const isHighlight = iso && highlightIso && iso === highlightIso;

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(evt) => {
                      if (!interactive || !meta) return;
                      setHover({ x: evt.clientX, y: evt.clientY, meta });
                    }}
                    onMouseMove={(evt) => {
                      if (!interactive || !meta) return;
                      setHover((prev) => prev && { ...prev, x: evt.clientX, y: evt.clientY });
                    }}
                    onMouseLeave={() => setHover(null)}
                    style={{
                      default: {
                        fill: conqueredColor ?? (isHighlight ? "#fbbf24" : "#1e2533"),
                        stroke: "#0b0d12",
                        strokeWidth: 0.4,
                        outline: "none",
                        transition: "fill 0.4s ease",
                        filter: isHighlight ? "drop-shadow(0 0 6px rgba(251,191,36,.9))" : undefined,
                      },
                      hover: {
                        fill: conqueredColor ?? (isHighlight ? "#fbbf24" : "#2a3445"),
                        outline: "none",
                        cursor: interactive ? "pointer" : "default",
                      },
                      pressed: { fill: conqueredColor ?? "#2a3445", outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      {/* Hover tooltip — never reveals the country name during active play */}
      <AnimatePresence>
        {hover && (() => {
          const conqueredColor = colorByIso.get(hover.meta.isoCode);
          const conquered = !!conqueredColor;
          const reveal = state?.status !== "playing" || conquered;
          return (
            <motion.div
              key={hover.meta.isoCode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none fixed z-50 glass px-3 py-2 rounded-lg text-xs leading-tight"
              style={{ left: hover.x + 14, top: hover.y + 14 }}
            >
              {reveal ? (
                <>
                  <div className="font-semibold text-white">{hover.meta.name}</div>
                  <div className="text-white/60">{hover.meta.capital} • {hover.meta.continent}</div>
                  <div className="text-white/60">{formatArea(hover.meta.areaKm2)}</div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-white">???</div>
                  <div className="text-white/60">{hover.meta.continent}</div>
                </>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Conquest splash */}
      <AnimatePresence>
        {lastConquest && (
          <motion.div
            key={lastConquest.at}
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="absolute top-3 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-xl flex items-center gap-2"
          >
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: lastConquest.color }} />
            <span className="font-semibold">{lastConquest.username}</span>
            <span className="text-white/60">claimed</span>
            <span className="font-mono">{lastConquest.isoCode}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
