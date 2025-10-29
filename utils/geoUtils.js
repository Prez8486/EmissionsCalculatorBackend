/**
 * Geo Utilities - Helper functions for geographic calculations
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  
  const toRad = (degrees) => degrees * Math.PI / 180;
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Validate latitude and longitude
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} True if valid
 */
function validateCoordinates(lat, lon) {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Format coordinates for display
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} precision - Decimal places (default: 6)
 * @returns {object} Formatted coordinates
 */
function formatCoordinates(lat, lon, precision = 6) {
  return {
    lat: parseFloat(lat.toFixed(precision)),
    lon: parseFloat(lon.toFixed(precision))
  };
}

/**
 * Create a bounding box around a point
 * @param {number} lat - Center latitude
 * @param {number} lon - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {object} Bounding box with min/max lat/lon
 */
function createBoundingBox(lat, lon, radiusKm) {
  // Rough approximation: 1 degree ≈ 111 km
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLon: lon - lonDelta,
    maxLon: lon + lonDelta
  };
}

/**
 * Check if a point is within a bounding box
 * @param {number} lat - Point latitude
 * @param {number} lon - Point longitude
 * @param {object} bbox - Bounding box {minLat, maxLat, minLon, maxLon}
 * @returns {boolean} True if point is inside bbox
 */
function isWithinBoundingBox(lat, lon, bbox) {
  return (
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lon >= bbox.minLon &&
    lon <= bbox.maxLon
  );
}

/**
 * Encode path coordinates to polyline string (Google Maps format)
 * Simplified version - for production use a library like @mapbox/polyline
 * @param {Array} coordinates - Array of {lat, lon} objects
 * @returns {string} Encoded polyline
 */
function encodePolyline(coordinates) {
  // This is a placeholder - use a proper library in production
  // For now, return JSON string
  return JSON.stringify(coordinates.map(c => [c.lat, c.lon]));
}

/**
 * Decode polyline string to coordinates
 * @param {string} encoded - Encoded polyline
 * @returns {Array} Array of {lat, lon} objects
 */
function decodePolyline(encoded) {
  // Placeholder - use a proper library in production
  try {
    const coords = JSON.parse(encoded);
    return coords.map(c => ({ lat: c[0], lon: c[1] }));
  } catch {
    return [];
  }
}

/**
 * Calculate bearing between two points
 * @param {number} lat1 - Start latitude
 * @param {number} lon1 - Start longitude
 * @param {number} lat2 - End latitude
 * @param {number} lon2 - End longitude
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => degrees * Math.PI / 180;
  const toDeg = (radians) => radians * 180 / Math.PI;
  
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Parse location string to coordinates
 * Accepts formats like "lat,lon" or {lat, lon}
 * @param {string|object} location - Location string or object
 * @returns {object} {lat, lon} or null if invalid
 */
function parseLocation(location) {
  if (typeof location === 'object' && location.lat && location.lon) {
    const lat = parseFloat(location.lat);
    const lon = parseFloat(location.lon);
    return validateCoordinates(lat, lon) ? { lat, lon } : null;
  }
  
  if (typeof location === 'string') {
    const parts = location.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && validateCoordinates(parts[0], parts[1])) {
      return { lat: parts[0], lon: parts[1] };
    }
  }
  
  return null;
}

module.exports = {
  haversineDistance,
  validateCoordinates,
  formatCoordinates,
  createBoundingBox,
  isWithinBoundingBox,
  encodePolyline,
  decodePolyline,
  calculateBearing,
  parseLocation
};