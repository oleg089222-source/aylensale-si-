"use client";

import { useEffect, useRef } from "react";
import type { CarBootLocation } from "../lib/types";

type Props = {
  locations: CarBootLocation[];
  selectedId?: string | null;
};

export function MapView({ locations, selectedId }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || mapInstance.current) return;
      leafletRef.current = L;
      const DefaultIcon = L.Icon.Default;
      DefaultIcon.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.5/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.5/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.5/images/marker-shadow.png",
      });

      mapInstance.current = L.map(mapRef.current!, {
        center: [52.48, -0.5],
        zoom: 7,
        zoomControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapInstance.current);

      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    if (!L || !mapInstance.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();
    if (locations.length === 0) return;

    locations.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lon]);
      marker.bindPopup(`<strong>${loc.name}</strong><br/>${loc.postcode}`);
      marker.addTo(markersLayer.current!);
    });

    const focus = locations.find((l) => l.id === selectedId) ?? locations[0];
    mapInstance.current.setView([focus.lat, focus.lon], 9, { animate: true });
  }, [locations, selectedId]);

  return (
    <div className="glass rounded-4xl border border-white/10 p-6 min-w-0">
      <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Карта</p>
      <p className="mt-2 text-lg font-semibold text-white">Car boot локации</p>
      <div className="mt-4 h-72 overflow-hidden rounded-3xl border border-white/10">
        <div ref={mapRef} className="h-full w-full leaflet-container" />
      </div>
    </div>
  );
}
