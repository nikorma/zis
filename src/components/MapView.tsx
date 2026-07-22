import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LatLng } from '../types';

export interface MapMarker {
  coords: LatLng;
  label: string;
  kind?: 'home' | 'stop' | 'user' | 'target';
}

function icon(kind: MapMarker['kind']) {
  const color = kind === 'home' ? '#2C5F7C' : kind === 'user' ? '#1a7f37' : kind === 'target' ? '#C9A227' : '#B4552D';
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
  });
}

/**
 * Mappa OpenStreetMap (nessuna chiave necessaria).
 * I tile visualizzati vengono messi in cache dal service worker:
 * le zone già viste restano disponibili offline (mappa semplificata).
 */
export default function MapView({
  markers,
  route,
  height = '60vh',
  highlight,
}: {
  markers: MapMarker[];
  route?: LatLng[];
  height?: string;
  highlight?: LatLng | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current, { zoomControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    const pts: L.LatLngExpression[] = [];
    for (const mk of markers) {
      const p: L.LatLngExpression = [mk.coords.lat, mk.coords.lng];
      pts.push(p);
      L.marker(p, { icon: icon(mk.kind), title: mk.label }).bindPopup(mk.label).addTo(g);
    }
    if (route && route.length > 1) {
      L.polyline(route.map((r) => [r.lat, r.lng] as L.LatLngExpression), {
        color: '#B4552D', weight: 4, opacity: 0.8, dashArray: '8 6',
      }).addTo(g);
    }
    if (highlight) {
      L.circle([highlight.lat, highlight.lng], {
        radius: 60, color: '#C9A227', fillColor: '#C9A227', fillOpacity: 0.2,
      }).addTo(g);
    }
    if (pts.length > 0) {
      m.fitBounds(L.latLngBounds(pts as L.LatLngExpression[]), { padding: [30, 30], maxZoom: 17 });
    } else {
      m.setView([42.3, 12.5], 5); // nessun punto: vista Italia
    }
  }, [markers, route, highlight]);

  return <div ref={el} style={{ height }} className="rounded-2xl overflow-hidden border border-[#e8ddca] dark:border-[#4a382c]" role="application" aria-label="Mappa interattiva" />;
}
