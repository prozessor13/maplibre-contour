# Contour Generation Algorithms

This library uses different algorithms for different contour generation methods:

## Overview

| Feature | Algorithm | Use Case | File |
|---------|-----------|----------|------|
| **thresholds** (interval-based) | Custom d3-contour | Interval-based contours (e.g., every 50m) | `isolines.ts` |
| **lineLevels** (fixed levels) | marching-squares `isoLines` | Fixed elevation contours (e.g., 500m, 700m, 900m) | `isolines-ms.ts` |
| **polygonLevels** (filled ranges) | marching-squares `isoBands` | Filled polygons between levels | `isobands-ms.ts` |

## Details

### 1. Thresholds (Interval-based Contours)

**Algorithm**: Custom implementation based on d3-contour
**File**: `src/isolines.ts`

```javascript
thresholds: {
  11: [50, 100]  // Every 50m and 100m
}
```

- Generates contour lines at regular intervals
- Optimized for multiple threshold levels in a single pass
- Best for traditional topographic maps with regular intervals

### 2. LineLevels (Fixed Elevation Contours)

**Algorithm**: marching-squares library `isoLines` function
**File**: `src/isolines-ms.ts`

```javascript
lineLevels: {
  11: [500, 700, 900, 1000, 1100]  // Exact elevations
}
```

- Generates contour lines at specific, fixed elevations
- Uses the marching-squares library for improved accuracy
- **NEW**: Added to support precise elevation levels
- Best for highlighting specific elevations or bathymetric depths
- Supports negative values for bathymetry (e.g., `-100, -75, -50, 0`)

### 3. PolygonLevels (Filled Elevation Ranges)

**Algorithm**: marching-squares library `isoBands` function
**File**: `src/isobands-ms.ts`

```javascript
polygonLevels: {
  11: [500, 700, 900, 1000]  // Creates ranges: 500-700, 700-900, 900-1000
}
```

- Generates filled polygons representing elevation ranges
- Each polygon represents the area BETWEEN two consecutive levels
- Like GDAL's `gdal_contour -p`
- Best for filled contour maps (hypsometric tints)
- **FIXED**: Now correctly handles negative values (format: `lower:upper`)

## Negative Values Support

All three methods now properly support negative values for bathymetry:

```javascript
// Bathymetry example
{
  lineLevels: { 11: [-100, -75, -50, -25, 0] },
  polygonLevels: { 11: [-100, -75, -50, -25, 0] }
}
```

**Important**: For `polygonLevels` and `isobands`, the internal range key format uses `:`
instead of `-` to avoid ambiguity with negative numbers (e.g., `-100:-75` instead of `-100--75`).

## Performance Considerations

- **thresholds**: Single-pass algorithm, efficient for many interval levels
- **lineLevels**: One pass per level, optimized by marching-squares
- **polygonLevels**: One pass per range, optimized by marching-squares

## Example Usage

See the included example files:
- `comparison-example.html` - Compare thresholds vs lineLevels
- `bathymetry-example.html` - Bathymetry with polygonLevels
- `test-negative-bathymetry.html` - Testing negative values
