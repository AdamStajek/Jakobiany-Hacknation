import type { Map as MapLibreMap } from 'maplibre-gl';
import type { TerraDraw } from 'terra-draw';
import type { Geometry } from '../../core/api/types';

/** Uruchamia rysowanie wielokąta (Terra Draw ładowany leniwie). `onPoints` dostaje liczbę postawionych punktów. */
export async function startPolygonDraw(map: MapLibreMap, onPoints: (count: number) => void,
    onFinish: (geometry: Geometry | null) => void): Promise<TerraDraw> {
  const [{TerraDraw, TerraDrawPolygonMode, TerraDrawModeUndoRedo}, {TerraDrawMapLibreGLAdapter}] = await Promise.all([
    import('terra-draw'), import('terra-draw-maplibre-gl-adapter')]);
  const draw = new TerraDraw({adapter: new TerraDrawMapLibreGLAdapter({map}), modes: [new TerraDrawPolygonMode()],
    undoRedo: {modeLevel: new TerraDrawModeUndoRedo()}});
  draw.start();
  draw.setMode('polygon');
  draw.on('history', (event) => onPoints(event.undoSize));
  draw.on('finish', (id) => {
    const feature = draw.getSnapshot().find((f) => f.id === id);
    onFinish(feature?.geometry.type === 'Polygon' ? feature.geometry as Geometry : null);
  });
  return draw;
}
