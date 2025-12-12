import type {
  ContourTile,
  DemTile,
  GlobalContourTileOptions,
  IndividualContourTileOptions,
  TransferrableContourTile,
  TransferrableDemTile,
} from "./types";

function sortedEntries(object: any): [string, any][] {
  const entries = Object.entries(object);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return entries;
}

function encodeThresholds(thresholds: {
  [n: number]: number | number[];
}): string {
  return sortedEntries(thresholds)
    .map(([key, value]) =>
      [key, ...(typeof value === "number" ? [value] : value)].join("*"),
    )
    .join("~");
}

function decodeThresholds(thresholds: string): {
  [n: number]: number | number[];
} {
  return Object.fromEntries(
    thresholds
      .split("~")
      .map((part) => part.split("*").map(Number))
      .map(([key, ...values]) => [key, values]),
  );
}

function encodeLevels(levels: { [n: number]: number[] }): string {
  return sortedEntries(levels)
    .map(([key, value]) => [key, ...value].join("*"))
    .join("~");
}

function decodeLevels(levels: string): {
  [n: number]: number[];
} {
  return Object.fromEntries(
    levels
      .split("~")
      .map((part) => part.split("*").map(Number))
      .map(([key, ...values]) => [key, values]),
  );
}

export function encodeOptions({
  thresholds,
  lineLevels,
  polygonLevels,
  ...rest
}: GlobalContourTileOptions): string {
  const encoded: any = { ...rest };
  if (thresholds) {
    encoded.thresholds = encodeThresholds(thresholds);
  }
  if (lineLevels) {
    encoded.lineLevels = encodeLevels(lineLevels);
  }
  if (polygonLevels) {
    encoded.polygonLevels = encodeLevels(polygonLevels);
  }
  return sortedEntries(encoded)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

export function decodeOptions(options: string): GlobalContourTileOptions {
  return Object.fromEntries(
    options
      .replace(/^.*\?/, "")
      .split("&")
      .map((part) => {
        const parts = part.split("=").map(decodeURIComponent);
        const k = parts[0] as keyof GlobalContourTileOptions;
        let v: any = parts[1];
        switch (k) {
          case "thresholds":
            v = decodeThresholds(v);
            break;
          case "lineLevels":
          case "polygonLevels":
            v = decodeLevels(v);
            break;
          case "extent":
          case "multiplier":
          case "overzoom":
          case "buffer":
            v = Number(v);
        }
        return [k, v];
      }),
  ) as any as GlobalContourTileOptions;
}

export function encodeIndividualOptions(
  options: IndividualContourTileOptions,
): string {
  return sortedEntries(options)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join(",");
}

export function getOptionsForZoom(
  options: GlobalContourTileOptions,
  zoom: number,
): IndividualContourTileOptions {
  const { thresholds, lineLevels, polygonLevels, ...rest } = options;

  let lineLevelsForZoom: number[] = [];
  let polygonLevelsForZoom: number[] | undefined = undefined;

  // Process thresholds (interval-based contour lines)
  if (thresholds) {
    let maxLessThanOrEqualTo: number = -Infinity;
    Object.entries(thresholds).forEach(([zString, value]) => {
      const z = Number(zString);
      if (z <= zoom && z > maxLessThanOrEqualTo) {
        maxLessThanOrEqualTo = z;
        lineLevelsForZoom = typeof value === "number" ? [value] : value;
      }
    });
  }

  // Process lineLevels (fixed elevation contour lines)
  if (lineLevels) {
    let maxLessThanOrEqualTo: number = -Infinity;
    Object.entries(lineLevels).forEach(([zString, value]) => {
      const z = Number(zString);
      if (z <= zoom && z > maxLessThanOrEqualTo) {
        maxLessThanOrEqualTo = z;
        lineLevelsForZoom = value;
      }
    });
  }

  // Process polygonLevels (fixed elevation polygon levels per zoom)
  if (polygonLevels) {
    let maxLessThanOrEqualTo: number = -Infinity;
    Object.entries(polygonLevels).forEach(([zString, value]) => {
      const z = Number(zString);
      if (z <= zoom && z > maxLessThanOrEqualTo) {
        maxLessThanOrEqualTo = z;
        polygonLevelsForZoom = value;
      }
    });
  }

  return {
    lineLevels: lineLevelsForZoom,
    polygonLevels: polygonLevelsForZoom,
    ...rest,
  };
}

export function copy(src: ArrayBuffer): ArrayBuffer {
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
}

export function prepareDemTile(
  promise: Promise<DemTile>,
  copy: boolean,
): Promise<TransferrableDemTile> {
  return promise.then(({ data, ...rest }) => {
    let newData = data;
    if (copy) {
      newData = new Float32Array(data.length);
      newData.set(data);
    }
    return { ...rest, data: newData, transferrables: [newData.buffer] };
  });
}

export function prepareContourTile(
  promise: Promise<ContourTile>,
): Promise<TransferrableContourTile> {
  return promise.then(({ arrayBuffer }) => {
    const clone = copy(arrayBuffer);
    return {
      arrayBuffer: clone,
      transferrables: [clone],
    };
  });
}

let supportsOffscreenCanvas: boolean | null = null;

export function offscreenCanvasSupported(): boolean {
  if (supportsOffscreenCanvas == null) {
    supportsOffscreenCanvas =
      typeof OffscreenCanvas !== "undefined" &&
      new OffscreenCanvas(1, 1).getContext("2d") &&
      typeof createImageBitmap === "function";
  }

  return supportsOffscreenCanvas || false;
}

let useVideoFrame: boolean | null = null;

export function shouldUseVideoFrame(): boolean {
  if (useVideoFrame == null) {
    useVideoFrame = false;
    // if webcodec is supported, AND if the browser mangles getImageData results
    // (ie. safari with increased privacy protections) then use webcodec VideoFrame API
    if (offscreenCanvasSupported() && typeof VideoFrame !== "undefined") {
      const size = 5;
      const canvas = new OffscreenCanvas(5, 5);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        for (let i = 0; i < size * size; i++) {
          const base = i * 4;
          context.fillStyle = `rgb(${base},${base + 1},${base + 2})`;
          context.fillRect(i % size, Math.floor(i / size), 1, 1);
        }
        const data = context.getImageData(0, 0, size, size).data;
        for (let i = 0; i < size * size * 4; i++) {
          if (i % 4 !== 3 && data[i] !== i) {
            useVideoFrame = true;
            break;
          }
        }
      }
    }
  }

  return useVideoFrame || false;
}

export function withTimeout<T>(
  timeoutMs: number,
  value: Promise<T>,
  abortController?: AbortController,
): Promise<T> {
  let reject: (error: Error) => void = () => {};
  const timeout = setTimeout(() => {
    reject(new Error("timed out"));
    abortController?.abort();
  }, timeoutMs);
  onAbort(abortController, () => {
    reject(new Error("aborted"));
    clearTimeout(timeout);
  });
  const cancelPromise: Promise<any> = new Promise((_, rej) => {
    reject = rej;
  });
  return Promise.race([
    cancelPromise,
    value.finally(() => clearTimeout(timeout)),
  ]);
}

export function onAbort(
  abortController?: AbortController,
  action?: () => void,
) {
  if (action) {
    abortController?.signal.addEventListener("abort", action);
  }
}

export function isAborted(abortController?: AbortController): boolean {
  return Boolean(abortController?.signal?.aborted);
}

/**
 * Simple seeded random number generator (LCG)
 * Returns a function that generates pseudorandom numbers between 0 and 1
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Generate a jittered grid of points for spot soundings.
 *
 * @param minx - Minimum x coordinate (in tile coordinates)
 * @param miny - Minimum y coordinate (in tile coordinates)
 * @param maxx - Maximum x coordinate (in tile coordinates)
 * @param maxy - Maximum y coordinate (in tile coordinates)
 * @param spacing - Grid spacing in tile coordinates
 * @param tileX - Tile X coordinate (for seeding)
 * @param tileY - Tile Y coordinate (for seeding)
 * @param tileZ - Tile Z coordinate (for seeding)
 * @returns Array of [x, y] coordinates
 */
export function generateJitteredGrid(
  minx: number,
  miny: number,
  maxx: number,
  maxy: number,
  spacing: number,
  tileX: number,
  tileY: number,
  tileZ: number,
): [number, number][] {
  const nx = Math.floor((maxx - minx) / spacing);
  const ny = Math.floor((maxy - miny) / spacing);

  const points: [number, number][] = [];

  // Use tile coordinates for seeding to ensure consistent jitter across tiles
  const seed = tileZ * 1000000 + tileX * 1000 + tileY;
  const random = seededRandom(seed);

  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const dx = (random() * spacing) / 2;
      const dy = (random() * spacing) / 2;
      const x = minx + i * spacing + dx + spacing / 4;
      const y = miny + j * spacing + dy + spacing / 4;
      if (x < maxx && y < maxy) {
        points.push([x, y]);
      }
    }
  }

  return points;
}
