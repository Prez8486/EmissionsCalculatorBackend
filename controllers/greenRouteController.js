const { getPythonBridge } = require('../utils/pythonBridge');
const { validateCoordinates, haversineDistance } = require('../utils/geoUtils');
const axios = require('axios');

async function calculateRoutes(req, res) {
    console.log('\n========================================');
    console.log('🗺️  ROUTE CALCULATION STARTED');
    console.log('========================================');
    
    try {
        const {
            start,
            destination,
            enabled_modes = ['car', 'walk', 'train', 'tram', 'bus'],
            preferences = {}
        } = req.body;

        console.log('📦 Request Data:');
        console.log('  - Start:', start);
        console.log('  - Destination:', destination);
        console.log('  - Enabled Modes:', enabled_modes);
        console.log('  - Preferences:', preferences);

        // Validate input presence
        if (!start || !destination) {
            console.log('❌ Validation Failed: Missing coordinates');
            return res.status(400).json({
                status: 'error',
                message: 'Missing required fields: start and destination'
            });
        }

        // Parse coordinates
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

        console.log('📍 Parsed Coordinates:');
        console.log('  Start: [', startLat, ',', startLon, ']');
        console.log('  Destination: [', destLat, ',', destLon, ']');

        // Validate coordinates
        if (!validateCoordinates(startLat, startLon)) {
            console.log('❌ Invalid start coordinates');
            return res.status(400).json({
                status: 'error',
                message: 'Invalid start coordinates'
            });
        }

        if (!validateCoordinates(destLat, destLon)) {
            console.log('❌ Invalid destination coordinates');
            return res.status(400).json({
                status: 'error',
                message: 'Invalid destination coordinates'
            });
        }

        // Check distance
        const directDistance = haversineDistance(startLat, startLon, destLat, destLon);
        console.log('📏 Direct Distance:', directDistance.toFixed(3), 'km');

        if (directDistance < 0.05) {
            console.log('❌ Distance too short (< 50m)');
            return res.status(400).json({
                status: 'error',
                message: 'Start and destination are too close (less than 50m)',
                distance_km: directDistance
            });
        }

        // Validate modes
        const validModes = ['car', 'walk', 'train', 'tram', 'bus'];
        const invalidModes = enabled_modes.filter(mode => !validModes.includes(mode));
        if (invalidModes.length > 0) {
            console.log('❌ Invalid transport modes:', invalidModes);
            return res.status(400).json({
                status: 'error',
                message: `Invalid transport modes: ${invalidModes.join(', ')}`,
                valid_modes: validModes
            });
        }

        if (enabled_modes.length === 0) {
            console.log('❌ No transport modes enabled');
            return res.status(400).json({
                status: 'error',
                message: 'At least one transport mode must be enabled'
            });
        }

        const maxTimeVariance = preferences.max_time_variance_percent || 20;
        console.log('⏱️  Max Time Variance:', maxTimeVariance, '%');

        // Call Python bridge to calculate routes
        console.log('\n🐍 Calling Python Bridge...');
        const pythonBridge = getPythonBridge();
        const routeResults = await pythonBridge.calculateRoutes(
            startLat,
            startLon,
            destLat,
            destLon,
            enabled_modes,
            maxTimeVariance
        );

        console.log('📡 Python Bridge Response Status:', routeResults.status);

        // Check for errors from Python
        if (routeResults.status === 'error') {
            console.log('⚠️  Python Bridge returned error:', routeResults.message);
            
            // Try OpenStreetMap as fallback for car routes
            if (enabled_modes.includes('car')) {
                console.log('\n🔄 Attempting OpenStreetMap Fallback...');
                const osmRoute = await getOSMRoute(startLat, startLon, destLat, destLon);
                
                if (osmRoute.success) {
                    console.log('✅ OSM Fallback Successful!');
                    console.log('  - Distance:', osmRoute.distance_km, 'km');
                    console.log('  - Duration:', osmRoute.duration_min, 'min');
                    
                    return res.status(200).json({
                        status: 'success',
                        fallback_used: true,
                        fallback_source: 'OpenStreetMap',
                        request_info: {
                            start: { lat: startLat, lon: startLon },
                            destination: { lat: destLat, lon: destLon },
                            direct_distance_km: parseFloat(directDistance.toFixed(2)),
                            enabled_modes,
                            max_time_variance_percent: maxTimeVariance
                        },
                        routes: {
                            fastest: osmRoute.route
                        },
                        show_alternative: false,
                        message: 'Using OpenStreetMap fallback route'
                    });
                } else {
                    console.log('❌ OSM Fallback Failed:', osmRoute.error);
                }
            }
            
            return res.status(404).json(routeResults);
        }

        // Log successful route calculation
        console.log('\n✅ Routes Calculated Successfully:');
        if (routeResults.routes.fastest) {
            console.log('  Fastest Route:');
            console.log('    - Distance:', routeResults.routes.fastest.summary.total_distance_km, 'km');
            console.log('    - Time:', routeResults.routes.fastest.summary.total_time_min, 'min');
            console.log('    - Emissions:', routeResults.routes.fastest.summary.total_emissions_kg, 'kg');
            console.log('    - Modes:', routeResults.routes.fastest.summary.modes_used.join(' → '));
        }
        
        if (routeResults.routes.greenest) {
            console.log('  Greenest Route:');
            console.log('    - Distance:', routeResults.routes.greenest.summary.total_distance_km, 'km');
            console.log('    - Time:', routeResults.routes.greenest.summary.total_time_min, 'min');
            console.log('    - Emissions:', routeResults.routes.greenest.summary.total_emissions_kg, 'kg');
            console.log('    - Modes:', routeResults.routes.greenest.summary.modes_used.join(' → '));
            if (routeResults.routes.greenest.comparison) {
                console.log('    - Savings:', routeResults.routes.greenest.comparison.emissions_saved_kg, 'kg');
            }
        } else {
            console.log('  ⚠️  No Green Alternative Found');
            console.log('    Reason:', routeResults.greenest_rejected_reason || 'Not available');
        }

        // Log snap info if available
        if (routeResults.snap_info) {
            console.log('\n📌 Node Snapping Info:');
            console.log('  Start Node:', routeResults.snap_info.start_node);
            console.log('  Start Distance:', routeResults.snap_info.start_snap_distance_m, 'm');
            console.log('  End Node:', routeResults.snap_info.end_node);
            console.log('  End Distance:', routeResults.snap_info.end_snap_distance_m, 'm');
        }

        // Format response for frontend
        const response = {
            status: 'success',
            fallback_used: false,
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

        console.log('\n✅ ROUTE CALCULATION COMPLETED');
        console.log('========================================\n');

        return res.status(200).json(response);

    } catch (error) {
        console.error('\n❌ ROUTE CALCULATION ERROR:');
        console.error('Error Message:', error.message);
        console.error('Stack Trace:', error.stack);
        console.log('========================================\n');

        return res.status(500).json({
            status: 'error',
            message: 'Internal server error during route calculation',
            error: error.message || 'Unknown error'
        });
    }
}

// OpenStreetMap Fallback Function
async function getOSMRoute(startLat, startLon, destLat, destLon) {
    try {
        console.log('🗺️  Calling OSRM (OpenStreetMap Routing)...');
        
        // Using OSRM demo server (for production, host your own)
        const url = `http://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson`;
        
        const response = await axios.get(url, { timeout: 10000 });
        
        if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
            return { success: false, error: 'No route found by OSRM' };
        }

        const route = response.data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;
        
        // Estimate emissions (basic car emission factor: 0.12 kg CO2/km)
        const emissionsKg = distanceKm * 0.12;

        // Convert coordinates
        const coordinates = route.geometry.coordinates.map(coord => ({
            lat: coord[1],
            lon: coord[0]
        }));

        return {
            success: true,
            distance_km: parseFloat(distanceKm.toFixed(2)),
            duration_min: parseFloat(durationMin.toFixed(1)),
            route: {
                summary: {
                    total_distance_km: parseFloat(distanceKm.toFixed(2)),
                    total_time_min: parseFloat(durationMin.toFixed(1)),
                    total_emissions_kg: parseFloat(emissionsKg.toFixed(4)),
                    modes_used: ['car'],
                    segments: [{
                        from_lat: startLat,
                        from_lon: startLon,
                        to_lat: destLat,
                        to_lon: destLon,
                        mode: 'car',
                        distance_km: parseFloat(distanceKm.toFixed(2)),
                        time_min: parseFloat(durationMin.toFixed(1)),
                        emissions_kg: parseFloat(emissionsKg.toFixed(4))
                    }]
                },
                path_coordinates: coordinates,
                segments: [{
                    from_lat: startLat,
                    from_lon: startLon,
                    to_lat: destLat,
                    to_lon: destLon,
                    mode: 'car',
                    distance_km: parseFloat(distanceKm.toFixed(2)),
                    time_min: parseFloat(durationMin.toFixed(1)),
                    emissions_kg: parseFloat(emissionsKg.toFixed(4))
                }]
            }
        };
    } catch (error) {
        console.error('❌ OSM Fallback Error:', error.message);
        return { success: false, error: error.message };
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

// Enhanced Post Trip Comparison with Environmental Impact
async function postTripAnalysis(req, res) {
  console.log('🚨 POST-TRIP ANALYSIS CALLED!');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  try {
    const {
      trip_id,
      actual_route, // Array of GPS coordinates from trip
      actual_emissions, // Calculated from trip data
      transport_mode
    } = req.body;

    console.log('📦 Request Data:');
    console.log('  - Trip ID:', trip_id);
    console.log('  - Transport Mode:', transport_mode);
    console.log('  - Actual Emissions:', actual_emissions, 'kg');
    console.log('  - Route Points:', actual_route?.length || 0);

    // Validate input
    if (!trip_id || !actual_route || actual_route.length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: trip_id and actual_route (min 2 points)'
      });
    }

    if (!actual_emissions || actual_emissions <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid actual_emissions value'
      });
    }

    // Get start and end from actual route
    const start = actual_route[0];
    const end = actual_route[actual_route.length - 1];

    console.log('\n📍 Route Coordinates:');
    console.log('  Start:', { lat: start.lat, lon: start.lon || start.lng });
    console.log('  End:', { lat: end.lat, lon: end.lon || end.lng });

    // Calculate what the greenest route would have been
    const pythonBridge = getPythonBridge();
    const result = await pythonBridge.calculateRoutes(
      start.lat,
      start.lon,
      end.lat,
      end.lon,
      ['car', 'walk', 'train', 'tram', 'bus'], // All modes
      100 // Accept any time variance for post-trip analysis
    );

    // Handle case where no green route found
    let greenestRoute = null;
    let hasGreenAlternative = false;

    if (result.status === 'success' && result.routes.greenest) {
      greenestRoute = result.routes.greenest;
      hasGreenAlternative = true;
      console.log('✅ Green Alternative Found!');
      console.log('  - Emissions:', greenestRoute.summary.total_emissions_kg, 'kg');
      console.log('  - Distance:', greenestRoute.summary.total_distance_km, 'km');
      console.log('  - Time:', greenestRoute.summary.total_time_min, 'min');
      console.log('  - Modes:', greenestRoute.summary.modes_used.join(' → '));
    } else {
      console.log('⚠️ No Green Alternative Found');
      console.log('  Reason:', result.greenest_rejected_reason || 'Route not available');
    }

    // Calculate actual route distance
    const actualDistance = calculateTotalDistance(actual_route);

    // Prepare response based on whether green alternative exists
    const response = {
      status: 'success',
      trip_id,
      has_green_alternative: hasGreenAlternative,
      actual: {
        emissions_kg: parseFloat(actual_emissions.toFixed(4)),
        distance_km: actualDistance,
        transport_mode: transport_mode,
        route_coordinates: actual_route.map(point => ({
          lat: point.lat,
          lon: point.lon || point.lng // Handle both lon/lng
        }))
      }
    };

    if (hasGreenAlternative) {
      const greenestEmissions = greenestRoute.summary.total_emissions_kg;
      const potentialSavings = actual_emissions - greenestEmissions;
      const timeDifference = greenestRoute.summary.total_time_min;

      console.log('\n💰 Savings Calculation:');
      console.log('  Actual Emissions:', actual_emissions, 'kg');
      console.log('  Green Emissions:', greenestEmissions, 'kg');
      console.log('  Potential Savings:', potentialSavings, 'kg');
      console.log('  Savings Percentage:', ((potentialSavings / actual_emissions) * 100).toFixed(1), '%');
      console.log('  Time Difference:', timeDifference, 'min');

      // Calculate environmental impacts for savings
      const individualImpact = calculateEnvironmentalImpact(Math.abs(potentialSavings));
      const collectiveImpact = calculateMelbourneCollectiveImpact(Math.abs(potentialSavings));

      response.greenest_alternative = {
        emissions_kg: parseFloat(greenestEmissions.toFixed(4)),
        time_min: parseFloat(timeDifference.toFixed(1)),
        distance_km: greenestRoute.summary.total_distance_km,
        modes_used: greenestRoute.summary.modes_used,
        route_coordinates: extractPathCoordinates(greenestRoute.summary.segments)
      };

      response.comparison = {
        emissions_saved_kg: parseFloat(potentialSavings.toFixed(4)),
        emissions_saved_percent: actual_emissions > 0 
          ? parseFloat(((potentialSavings / actual_emissions) * 100).toFixed(1))
          : 0,
        time_difference_min: parseFloat(timeDifference.toFixed(1)),
        is_better: potentialSavings > 0.01,
        message: potentialSavings > 0.01
          ? `You could have saved ${potentialSavings.toFixed(2)}kg CO₂ by taking an alternative route`
          : 'You took an efficient route!'
      };

      response.environmental_impact = {
        individual: individualImpact,
        collective: collectiveImpact
      };
    } else {
      // No green alternative found - just show impact of current trip
      const tripImpact = calculateEnvironmentalImpact(actual_emissions);
      
      response.message = 'You took an efficient route! No greener alternative was available.';
      response.environmental_impact = {
        individual: tripImpact,
        collective: null // No collective impact if no savings
      };
    }

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

// Calculate environmental impact metrics
function calculateEnvironmentalImpact(emissionsKg) {
  // Trees needed to offset (1 tree absorbs ~22kg CO2/year)
  const treesNeeded = Math.ceil(emissionsKg / 22);
  
  // Plastic bottles equivalent (1 bottle = ~0.04kg CO2)
  const plasticBottles = Math.round(emissionsKg / 0.04);
  
  // Sea-level rise contribution (1 tonne CO2 = ~0.0015mm)
  const seaLevelMm = parseFloat(((emissionsKg / 1000) * 0.0015).toFixed(6));
  
  // Temperature contribution (1 tonne CO2 = ~0.0000015°C)
  const temperatureCelsius = parseFloat(((emissionsKg / 1000) * 0.0000015).toFixed(9));
  
  // Disaster frequency impact (statistical correlation ~0.002% per tonne)
  const disasterFrequencyPercent = parseFloat(((emissionsKg / 1000) * 0.00002).toFixed(7));

  return {
    trees_needed: treesNeeded,
    plastic_bottles_equivalent: plasticBottles,
    sea_level_rise_mm: seaLevelMm,
    temperature_impact_celsius: temperatureCelsius,
    disaster_frequency_increase_percent: disasterFrequencyPercent
  };
}

// Calculate environmental impact metrics
function calculateEnvironmentalImpact(emissionsKg) {
  // Trees needed to offset (1 tree absorbs ~22kg CO2/year)
  const treesNeeded = Math.ceil(emissionsKg / 22);
  
  // Plastic bottles equivalent (1 bottle = ~0.04kg CO2)
  const plasticBottles = Math.round(emissionsKg / 0.04);
  
  // Sea-level rise contribution (1 tonne CO2 = ~0.0015mm)
  const seaLevelMm = parseFloat(((emissionsKg / 1000) * 0.0015).toFixed(6));
  
  // Temperature contribution (1 tonne CO2 = ~0.0000015°C)
  const temperatureCelsius = parseFloat(((emissionsKg / 1000) * 0.0000015).toFixed(9));
  
  // Disaster frequency impact (statistical correlation ~0.002% per tonne)
  const disasterFrequencyPercent = parseFloat(((emissionsKg / 1000) * 0.00002).toFixed(7));

  return {
    trees_needed: treesNeeded,
    plastic_bottles_equivalent: plasticBottles,
    sea_level_rise_mm: seaLevelMm,
    temperature_impact_celsius: temperatureCelsius,
    disaster_frequency_increase_percent: disasterFrequencyPercent
  };
}

// Calculate Melbourne collective impact (5M population)
function calculateMelbourneCollectiveImpact(savingsKg, tripsPerYear = 365) {
  const MELBOURNE_POPULATION = 5000000;
  const annualSavingsKg = savingsKg * MELBOURNE_POPULATION * tripsPerYear;
  const annualSavingsTonnes = annualSavingsKg / 1000;

  return {
    population: MELBOURNE_POPULATION,
    trips_per_year: tripsPerYear,
    annual_savings_kg: parseFloat(annualSavingsKg.toFixed(2)),
    annual_savings_tonnes: Math.round(annualSavingsTonnes),
    trees_equivalent: Math.ceil(annualSavingsKg / 22),
    plastic_bottles_equivalent: Math.round(annualSavingsKg / 0.04),
    sea_level_prevented_mm: parseFloat(((annualSavingsKg / 1000) * 0.0015).toFixed(3)),
    temperature_prevented_celsius: parseFloat(((annualSavingsKg / 1000) * 0.0000015).toFixed(6)),
    disaster_frequency_reduced_percent: parseFloat(((annualSavingsKg / 1000) * 0.00002).toFixed(5))
  };
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