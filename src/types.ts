import type Actor from "./actor";
import type { Timer } from "./performance";
import type WorkerDispatch from "./worker-dispatch";

/** Scheme used to map pixel rgb values elevations. */
export type Encoding = "terrarium" | "mapbox";
export interface IsTransferrable {
  transferrables: Transferable[];
}
/** A decoded `raster-rgb` image. */
export interface DemTile {
  width: number;
  height: number;
  /** elevation values in row-major order */
  data: Float32Array;
}
export interface TransferrableDemTile extends DemTile, IsTransferrable {}
/** A rendered contour tile */
export interface ContourTile {
  /** Encoded mapbox vector tile bytes */
  arrayBuffer: ArrayBuffer;
}
export interface TransferrableContourTile
  extends ContourTile,
    IsTransferrable {}

export interface FetchResponse {
  data: Blob;
  expires?: string;
  cacheControl?: string;
}

/** Parameters to use when creating a contour vector tile from raw elevation data */
export interface ContourTileOptions {
  /** Factor to scale the elevation meters by to support different units (default 1 for meters) */
  multiplier?: number;
  /**
   * Request `raster-dem` tiles from lower zoom levels to generate the contour vector tile.
   *
   * The default value is 0, which means to generate a contour vector tile at z10, it gets
   * the z10 `raster-dem` tile plus its 8 neighbors
   *
   * Setting to 1 requests a z9 tile and uses one quadrant of it so that it only needs up to 3
   * neighboring tiles to get the neighboring elevation data. It also improves performance with
   * 512x512 or larger `raster-dem` tiles.
   */
  overzoom?: number;
  /** Key for the elevation property to set on each contour line. */
  elevationKey?: string;
  /** Key for the "level" property to set on each contour line. Minor lines have level=0, major have level=1 */
  levelKey?: string;
  /** Name of the vector tile layer to put contour lines in */
  contourLayer?: string;
  /** Grid size of the vector tile (default 4096) */
  extent?: number;
  /** How many pixels to generate on each tile into the neighboring tile to reduce rendering artifacts */
  buffer?: number;
  /** When overzooming tiles, subsample to scale up to at least this size to make the contour lines smoother at higher zooms. */
  subsampleBelow?: number;
  /** Name of the vector tile layer to put contour polygons in (default "contour-polygons") */
  polygonLayer?: string;
  /** Key for the lower elevation boundary on polygon features */
  lowerElevationKey?: string;
  /** Key for the upper elevation boundary on polygon features */
  upperElevationKey?: string;
  /** Grid spacing in pixels for spot soundings (if undefined, no spot soundings are generated) */
  spotGridSpacing?: number;
  /** Sort order for spot soundings in vector tiles: "asc" (ascending elevation) or "desc" (descending elevation). Default: "desc" */
  spotSortOrder?: "asc" | "desc";
  /** Name of the vector tile layer to put spot soundings in (default "spot-soundings") */
  spotLayer?: string;
}

export interface GlobalContourTileOptions extends ContourTileOptions {
  /**
   * Map from zoom level to the `[minor, major]` elevation distance between contour lines.
   *
   * Contour lines without an entry will use the threshold for the next lower zoom.
   *
   * The `level` tag on each contour line will have an integer that corresponds to the largest index in
   * this array that the elevation is a multiple of.
   */
  thresholds?: { [n: number]: number | number[] };
  /**
   * Map from zoom level to fixed elevation levels for contour lines.
   *
   * Unlike thresholds which define intervals, this specifies exact elevations (e.g., [100, 200, 500, 1000]).
   * Contour lines without an entry will use the levels for the next lower zoom.
   *
   * Cannot be used together with thresholds - use one or the other.
   */
  lineLevels?: { [n: number]: number[] };
  /**
   * Map from zoom level to fixed elevation levels for polygon generation.
   *
   * Defines exact elevations for isoband polygons per zoom level (e.g., [500, 700, 900, 1000]).
   * Polygons without an entry will use the levels for the next lower zoom.
   */
  polygonLevels?: { [n: number]: number[] };
}

export interface IndividualContourTileOptions extends ContourTileOptions {
  lineLevels?: number[];
  polygonLevels?: number[];
}

export interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

export type TimingCategory = "main" | "worker" | "fetch" | "decode" | "isoline";

/** Performance profile for a tile request */
export interface Timing {
  /** The "virtual" tile url using the protocol ID registered with maplibre */
  url: string;
  /** Timing origin that all marks are relative to. */
  origin: number;
  /** Overall duration of the request */
  duration: number;
  /** Time spent fetching all resources, or `undefined` if they were cached */
  fetch?: number;
  /** Time spent decoding all raster-rgb images, or `undefined` if it was cached */
  decode?: number;
  /** Time spent generating isolines and rendering the vector tile, or `undefined` if it was cached */
  process?: number;
  wait: number;
  /** Number of tiles used for generation, even if they were cached */
  tilesUsed: number;
  /** Map from category (fetch, main, isoline) to list of start/end timestamps */
  marks: {
    [key in TimingCategory]?: number[][];
  };
  /** Detailed timing for all resources actually fetched (not cached) to generate this tile */
  resources: PerformanceResourceTiming[];
  /** If the tile failed with an error */
  error?: boolean;
}

/**
 * Holds cached tile state, and exposes `fetchContourTile` which fetches the necessary
 * tiles and returns an encoded contour vector tiles.
 */
export interface DemManager {
  loaded: Promise<any>;
  fetchTile(
    z: number,
    x: number,
    y: number,
    abortController: AbortController,
    timer?: Timer,
  ): Promise<FetchResponse>;
  fetchAndParseTile(
    z: number,
    x: number,
    y: number,
    abortController: AbortController,
    timer?: Timer,
  ): Promise<DemTile>;
  fetchContourTile(
    z: number,
    x: number,
    y: number,
    options: IndividualContourTileOptions,
    abortController: AbortController,
    timer?: Timer,
  ): Promise<ContourTile>;
}

export type GetTileFunction = (
  url: string,
  abortController: AbortController,
) => Promise<FetchResponse>;

export type DecodeImageFunction = (
  blob: Blob,
  encoding: Encoding,
  abortController: AbortController,
) => Promise<DemTile>;

export type DemManagerRequiredInitializationParameters = {
  demUrlPattern: string;
  cacheSize: number;
  encoding: Encoding;
  maxzoom: number;
  timeoutMs: number;
};

export type DemManagerInitizlizationParameters =
  DemManagerRequiredInitializationParameters & {
    decodeImage?: DecodeImageFunction;
    getTile?: GetTileFunction;
    actor?: Actor<WorkerDispatch>;
  };

export type InitMessage = DemManagerRequiredInitializationParameters & {
  managerId: number;
};
