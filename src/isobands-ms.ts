/*
Isoband generation using the marching-squares library.
Generates filled polygons for elevation ranges (e.g., 500-700m, 700-900m, etc.)
*/

import { isoBands } from "marching-squares";
import type { HeightTile } from "./height-tile";

/**
 * Generate filled polygons for elevation ranges between levels.
 *
 * Like GDAL contour -p, this generates polygons representing areas BETWEEN elevation levels.
 * For levels [500, 700, 900, 1000], it creates:
 * - Polygon(s) for areas between 500-700m
 * - Polygon(s) for areas between 700-900m
 * - Polygon(s) for areas between 900-1000m
 *
 * For bathymetry with negative levels [-100, -75, -50, 0], it creates:
 * - Polygon(s) for areas between -100 and -75m
 * - Polygon(s) for areas between -75 and -50m
 * - Polygon(s) for areas between -50 and 0m
 *
 * @param levels Array of elevation levels (e.g., [500, 700, 900, 1000] or [-100, -75, -50, 0])
 * @param tile The input height tile
 * @param extent Vector tile extent (default 4096)
 * @param buffer How many pixels into each neighboring tile to include
 * @returns Object mapping "lower:upper" ranges to arrays of polygons (e.g., "500:700" or "-100:-75")
 */
export default function generateIsobands(
  levels: number[] | string,
  tile: HeightTile,
  extent: number = 4096,
  _buffer: number = 1,
): { [key: string]: number[][] } {
  // Handle string input (from URL encoding) by parsing as array
  let levelArray: number[];
  if (typeof levels === "string") {
    levelArray = levels
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
  } else {
    levelArray = levels;
  }

  if (!levelArray || levelArray.length === 0) {
    return {};
  }

  const result: { [key: string]: number[][] } = {};

  // Sort levels to create ranges
  const sortedLevels = [...levelArray].sort((a, b) => a - b);

  // Convert HeightTile to 2D array for marching-squares
  const width = tile.width;
  const height = tile.height;
  const data: number[][] = [];

  for (let y = 0; y < height; y++) {
    data[y] = [];
    for (let x = 0; x < width; x++) {
      data[y][x] = tile.get(x, y);
    }
  }

  // Generate iso bands for each range between consecutive levels
  for (let i = 0; i < sortedLevels.length - 1; i++) {
    const lowerLevel = sortedLevels[i];
    const upperLevel = sortedLevels[i + 1];
    // Use colon separator to avoid issues with negative values (e.g., "-100--75" becomes "-100:-75")
    const rangeKey = `${lowerLevel}:${upperLevel}`;

    try {
      // Use marching-squares to generate bands
      // isoBands(data, thresholds, bandwidths)
      const thresholds = [lowerLevel];
      const bandwidths = [upperLevel - lowerLevel];

      const bands = isoBands(data, thresholds, bandwidths, {
        linearRing: true,
        noFrame: true,
      });

      // Convert marching-squares output to our format
      // bands is an array of arrays of paths
      const polygons: number[][] = [];

      if (bands.length > 0 && bands[0].length > 0) {
        for (const path of bands[0]) {
          // path is an array of [x, y] coordinates
          // Convert to flat array and scale to extent
          const polygon: number[] = [];
          const scale = extent / (width - 1);

          for (const [x, y] of path) {
            polygon.push(Math.round(x * scale), Math.round(y * scale));
          }

          if (polygon.length >= 6) {
            polygons.push(polygon);
          }
        }
      }

      if (polygons.length > 0) {
        result[rangeKey] = polygons;
      }
    } catch (err) {
      console.error(`[ISOBANDS] Error processing range ${rangeKey}:`, err);
    }
  }

  return result;
}
