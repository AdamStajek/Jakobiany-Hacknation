import type { StyleSpecification } from 'maplibre-gl';

const GUGIK_ORTO = 'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution'
  + '?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg'
  + '&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}';
const GUGIK_PARCELS = 'https://integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow'
  + '?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=dzialki,numery_dzialek&STYLES=&FORMAT=image/png'
  + '&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

export type Basemap = 'osm' | 'orto';
export const POLAND_CENTER: [number, number] = [19.2, 52.05];

/** Darmowe podkłady: OpenStreetMap, ortofotomapa GUGiK oraz granice i numery działek EGiB (GUGiK). */
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'},
    orto: {type: 'raster', tiles: [GUGIK_ORTO], tileSize: 256, maxzoom: 19,
      attribution: 'Ortofotomapa © <a href="https://www.geoportal.gov.pl" target="_blank" rel="noopener">GUGiK</a>'},
    ewidencja: {type: 'raster', tiles: [GUGIK_PARCELS], tileSize: 256, minzoom: 15, maxzoom: 20,
      attribution: 'Granice działek © GUGiK'},
  },
  layers: [
    {id: 'osm', type: 'raster', source: 'osm'},
    {id: 'orto', type: 'raster', source: 'orto', layout: {visibility: 'none'}},
    {id: 'ewidencja', type: 'raster', source: 'ewidencja', minzoom: 15},
  ],
};
