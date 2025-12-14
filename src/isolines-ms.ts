/*
Isoline generation using the marching-squares library.
Generates contour lines for specific elevation levels.
*/

import { isoLines } from "marching-squares";
import type { HeightTile } from "./height-tile";

/**
 * Generate contour lines using marching-squares library for fixed elevation levels.
 *
 * This uses the `isolines` function from marching-squares, which is optimized for
 * generating contour lines at specific elevation levels (as opposed to intervals).
 *
 * For levels [500, 700, 900, 1000], it creates:
 * - Contour line(s) at 500m elevation
 * - Contour line(s) at 700m elevation
 * - Contour line(s) at 900m elevation
 * - Contour line(s) at 1000m elevation
 *
 * For bathymetry with negative levels [-100, -50, 0], it creates:
 * - Contour line(s) at -100m elevation
 * - Contour line(s) at -50m elevation
 * - Contour line(s) at 0m elevation
 *
 * @param levels Array of elevation levels (e.g., [500, 700, 900, 1000] or [-100, -50, 0])
 * @param tile The input height tile
 * @param extent Vector tile extent (default 4096)
 * @param buffer How many pixels into each neighboring tile to include
 * @returns Object mapping elevation levels to arrays of line geometries
 */
export default function generateIsolinesMS(
  levels: number[] | string,
  tile: HeightTile,
  extent: number = 4096,
  _buffer: number = 1,
): { [ele: number]: number[][] } {
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

  const result: { [ele: number]: number[][] } = {};

  // Sort levels
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

  // Generate isolines for each level
  for (const level of sortedLevels) {
    try {
      // Use marching-squares isoLines function
      // isoLines returns Ring[][] where Ring is Coord[] and Coord is [number, number]
      // For a single threshold, it returns an array with one element (array of rings)
      const linesResult = isoLines(data, [level], {
        linearRing: false, // We want open paths for contour lines
        noFrame: true, // Don't include frame edges
      });

      // Convert marching-squares output to our format
      const geometries: number[][] = [];

      // linesResult[0] contains all rings for this threshold level
      if (linesResult.length > 0) {
        const lines = linesResult[0];
        for (const line of lines) {
          // line is an array of [x, y] coordinates
          // Convert to flat array and scale to extent
          const geometry: number[] = [];
          const scale = extent / (width - 1);

          for (const [x, y] of line) {
            geometry.push(Math.round(x * scale), Math.round(y * scale));
          }

          // Only include lines with at least 2 points (4 coordinates)
          if (geometry.length >= 4) {
            geometries.push(geometry);
          }
        }
      }

      if (geometries.length > 0) {
        result[level] = geometries;
      }
    } catch (err) {
      console.error(`[ISOLINES-MS] Error processing level ${level}:`, err);
    }
  }

  return result;
}
