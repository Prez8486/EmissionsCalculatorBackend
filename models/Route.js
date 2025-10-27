const mongoose = require('mongoose');

const RouteSegmentSchema = new mongoose.Schema({
  from_node: String,
  to_node: String,
  from_lat: Number,
  from_lon: Number,
  to_lat: Number,
  to_lon: Number,
  mode: {
    type: String,
    enum: ['car', 'walk', 'train', 'tram', 'bus']
  },
  distance_km: Number,
  time_min: Number,
  emissions_kg: Number
}, { _id: false });

const RouteSummarySchema = new mongoose.Schema({
  total_distance_km: Number,
  total_time_min: Number,
  total_emissions_kg: Number,
  modes_used: [String],
  segments: [RouteSegmentSchema]
}, { _id: false });

const RouteSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  trip_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: false // Only set if route was used for a trip
  },
  start_location: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  destination: {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true }
  },
  enabled_modes: [{
    type: String,
    enum: ['car', 'walk', 'train', 'tram', 'bus']
  }],
  fastest_route: RouteSummarySchema,
  greenest_route: RouteSummarySchema,
  selected_route: {
    type: String,
    enum: ['fastest', 'greenest'],
    required: false // Set when user makes choice
  },
  show_alternative: {
    type: Boolean,
    default: false
  },
  greenest_rejected_reason: String,
  calculated_at: {
    type: Date,
    default: Date.now
  },
  used_at: {
    type: Date,
    required: false // Set when trip starts
  }
}, {
  timestamps: true
});

// Index for efficient queries
RouteSchema.index({ user_id: 1, calculated_at: -1 });
RouteSchema.index({ trip_id: 1 });

// Static method to save a calculated route
RouteSchema.statics.saveCalculatedRoute = async function(userId, routeData) {
  const route = new this({
    user_id: userId,
    start_location: routeData.start_location,
    destination: routeData.destination,
    enabled_modes: routeData.enabled_modes,
    fastest_route: routeData.fastest_route,
    greenest_route: routeData.greenest_route,
    show_alternative: routeData.show_alternative,
    greenest_rejected_reason: routeData.greenest_rejected_reason
  });
  
  return await route.save();
};

// Instance method to mark route as used
RouteSchema.methods.markAsUsed = async function(tripId, selectedRoute) {
  this.trip_id = tripId;
  this.selected_route = selectedRoute;
  this.used_at = new Date();
  return await this.save();
};

// Instance method to get emissions comparison
RouteSchema.methods.getEmissionsComparison = function() {
  if (!this.greenest_route || !this.fastest_route) {
    return null;
  }

  const savedEmissions = this.fastest_route.total_emissions_kg - this.greenest_route.total_emissions_kg;
  const savedPercent = (savedEmissions / this.fastest_route.total_emissions_kg) * 100;

  return {
    fastest_emissions_kg: this.fastest_route.total_emissions_kg,
    greenest_emissions_kg: this.greenest_route.total_emissions_kg,
    potential_savings_kg: parseFloat(savedEmissions.toFixed(4)),
    potential_savings_percent: parseFloat(savedPercent.toFixed(1)),
    time_difference_min: this.greenest_route.total_time_min - this.fastest_route.total_time_min
  };
};

const Route = mongoose.model('Route', RouteSchema);

module.exports = Route;