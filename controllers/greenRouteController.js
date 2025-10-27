const { getPythonBridge } = require('../utils/pythonBridge');
const { validateCoordinates, haversineDistance } = require('../utils/geoUtils');

async function calculateRoutes(req, res) {
    try {
        const {
            start,
            destination,
            enabled_modes = ['car', 'walk', 'train', 'tram', 'bus'],
            preferences = {} // optional preferences
        } = req.body;

        // Validate input presence
        if (!start || !destination) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: start and destination'
            });
        }

        // Parse coordinates (support both arrays and {lat, lon} objects)
        let startLat, startLon, destLat, destLon;

        if (Array.isArray(start)) {
            [startLat, startLon] = start;
        } else {
            startLat = parseFloat(start.lat);
            startLon = parseFloat(start.lon);
        }

        if (Array.isArray(destination)) {
            [destLat, destLon] = destination;
        } else {
            destLat = parseFloat(destination.lat);
            destLon = parseFloat(destination.lon);
        }

        // Validate coordinates with your validateCoordinates function
        if (!validateCoordinates(startLat, startLon)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid start coordinates'
            });
        }

        if (!validateCoordinates(destLat, destLon)) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid destination coordinates'
            });
        }

        // Check if start and destination are too close
        const directDistance = haversineDistance(startLat, startLon, destLat, destLon);
        if (directDistance < 0.05) {
            return res.status(400).json({
                status: 'error',
                message: 'Start and destination are too close (less than 50m)',
                distance_km: directDistance
            });
        }

        // Validate enabled modes
        const validModes = ['car', 'walk', 'train', 'tram', 'bus'];
        const invalidModes = enabled_modes.filter(mode => !validModes.includes(mode));
        if (invalidModes.length > 0) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid transport modes: ${invalidModes.join(', ')}`,
                valid_modes: validModes
            });
        }

        if (enabled_modes.length === 0) {
            return res.status(400).json({
                status: 'error',
                message: 'At least one transport mode must be enabled'
            });
        }

        // Get max time variance
        const maxTimeVariance = preferences.max_time_variance_percent || 20;

        // Call Python bridge to calculate routes
        const pythonBridge = getPythonBridge();
        const routeResults = await pythonBridge.calculateRoutes(
            startLat,
            startLon,
            destLat,
            destLon,
            enabled_modes,
            maxTimeVariance
        );

        // Check for errors from Python
        if (routeResults.status === 'error') {
            return res.status(404).json(routeResults);
        }

        // Format response for frontend
        const response = {
            status: 'success',
            request_info: {
                start: { lat: startLat, lon: startLon },
                destination: { lat: destLat, lon: destLon },
                direct_distance_km: parseFloat(directDistance.toFixed(2)),
                enabled_modes,
                max_time_variance_percent: maxTimeVariance
            },
            snap_info: routeResults.snap_info,
            routes: formatRoutesForFrontend(routeResults.routes),
            show_alternative: routeResults.show_alternative,
            greenest_rejected_reason: routeResults.greenest_rejected_reason || null
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error('Route calculation error:', error);

        return res.status(500).json({
            status: 'error',
            message: 'Internal server error during route calculation',
            error: error.message || 'Unknown error'
        });
    }
}

// Format Routes for Frontend
function formatRoutesForFrontend(routes) {
    const formatted = {};

    //Fastest Route
    if (routes.fastest) {
        formatted.fastest = {
            summary: routes.fastest.summary,
            path_coordinates: extractPathCoordinates(routes.fastest.summary.segments),
            segments: routes.fastest.summary.segments
        };
    }

    // Format greenest route
    if (routes.greenest) {
        formatted.greenest = {
            summary: routes.greenest.summary,
            path_coordinates: extractPathCoordinates(routes.greenest.summary.segments),
            segments: routes.greenest.summary.segments,
            comparison: routes.greenest.comparison || null
        };
    }

    return formatted;
}

// Extract path coordinates from segments (for Map Rendering)
function extractPathCoordinates(segments) {
    const coordinates = [];

    segments.forEach((segment, index) => {  // FIXED: added index parameter
        // Add from coordinate
        coordinates.push({
            lat: segment.from_lat,
            lon: segment.from_lon,
            mode: segment.mode
        });
    
        // Add to coordinate for last segment
        if (index === segments.length - 1) {
            coordinates.push({
                lat: segment.to_lat,
                lon: segment.to_lon,
                mode: segment.mode
            });
        }
    });
  
    return coordinates;
}

// Get Graph Statistics
async function getGraphStats(req, res) {
  try {
    const pythonBridge = getPythonBridge();
    const result = await pythonBridge.getGraphStats();

    if (result.status === 'error') {
      return res.status(500).json(result);
    }

    return res.status(200).json({
      status: 'success',
      stats: result.stats
    });

  } catch (error) {
    console.error('Graph stats error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve graph statistics',
      error: error.message || 'Unknown error'
    });
  }
}

// Test Python Bridge Connection
async function testConnection(req, res) {
  try {
    const pythonBridge = getPythonBridge();
    const result = await pythonBridge.test();

    if (result.success) {
      return res.status(200).json({
        status: 'success',
        message: 'Python bridge is working correctly',
        stats: result.stats
      });
    } else {
      return res.status(500).json({
        status: 'error',
        message: 'Python bridge connection failed',
        error: result.error
      });
    }

  } catch (error) {
    console.error('Connection test error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to test Python bridge',
      error: error.message || 'Unknown error'
    });
  }
}

// Calculate Post Trip Comparison
async function postTripAnalysis(req, res) {
  try {
    const {
      trip_id,
      actual_route, // Array of GPS coordinates from trip
      actual_emissions // Calculated from trip data
    } = req.body;

    // Validate input
    if (!trip_id || !actual_route || actual_route.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: trip_id and actual_route (min 2 points)'
      });
    }

    // Get start and end from actual route
    const start = actual_route[0];
    const end = actual_route[actual_route.length - 1];

    // Calculate what the greenest route would have been
    const pythonBridge = getPythonBridge();
    const result = await pythonBridge.calculateRoutes(
      start.lat,
      start.lon,
      end.lat,
      end.lon,
      ['car', 'walk', 'train', 'tram', 'bus'], // All modes
      100 // Accept any time variance for post-trip
    );

    if (result.status === 'error') {
      return res.status(404).json(result);
    }

    // Compare actual vs greenest
    const greenestEmissions = result.routes.greenest?.summary.total_emissions_kg || 0;
    const potentialSavings = actual_emissions - greenestEmissions;

    const response = {
      status: 'success',
      trip_id,
      actual: {
        emissions_kg: actual_emissions,
        distance_km: calculateTotalDistance(actual_route)
      },
      greenest_alternative: {
        emissions_kg: greenestEmissions,
        time_min: result.routes.greenest?.summary.total_time_min,
        distance_km: result.routes.greenest?.summary.total_distance_km,
        modes_used: result.routes.greenest?.summary.modes_used
      },
      comparison: {
        emissions_saved_kg: parseFloat(potentialSavings.toFixed(4)),
        emissions_saved_percent: actual_emissions > 0 
          ? parseFloat(((potentialSavings / actual_emissions) * 100).toFixed(1))
          : 0,
        message: potentialSavings > 0.01
          ? `You could have saved ${potentialSavings.toFixed(2)}kg CO₂ by taking an alternative route`
          : 'You took an efficient route!'
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Post-trip analysis error:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to analyze trip',
      error: error.message || 'Unknown error'
    });
  }
}

// Calculate total distance from GPS route
function calculateTotalDistance(coordinates) {
  let totalDistance = 0;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const dist = haversineDistance(
      coordinates[i].lat,
      coordinates[i].lon,
      coordinates[i + 1].lat,
      coordinates[i + 1].lon
    );
    totalDistance += dist;
  }
  
  return parseFloat(totalDistance.toFixed(2));
}

module.exports = {
  calculateRoutes,
  getGraphStats,
  testConnection,
  postTripAnalysis
};