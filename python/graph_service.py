"""
Graph Service - Handles loading and querying the multimodal transport graph
"""
import networkx as nx
import pickle
import os
from math import radians, sin, cos, sqrt, atan2

class GraphService:
    def __init__(self, graph_path=None):
        """Initialize and load the graph"""
        self.graph = None
        
        # If no path provided, look in the same directory as this script
        if graph_path is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            graph_path = os.path.join(script_dir, 'combined_graph.gpickle')
        
        self.graph_path = graph_path
        self.load_graph()
    
    def load_graph(self):
        """Load the pickled graph into memory"""
        try:
            if not os.path.exists(self.graph_path):
                raise FileNotFoundError(f"Graph file not found: {self.graph_path}")
            
            with open(self.graph_path, 'rb') as f:
                self.graph = pickle.load(f)
            
            # Print to stderr so it doesn't interfere with JSON output to stdout
            import sys
            print(f"Graph loaded: {self.graph.number_of_nodes()} nodes, {self.graph.number_of_edges()} edges", file=sys.stderr)
            return True
        except Exception as e:
            import sys
            print(f"Error loading graph: {str(e)}", file=sys.stderr)
            raise
    
    def haversine_distance(self, lat1, lon1, lat2, lon2):
        """
        Calculate distance between two coordinates in kilometers
        """
        R = 6371  # Earth radius in km
        
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        
        return R * c
    
    def find_nearest_node(self, lat, lon, mode_filter=None, max_distance_km=1.0):
        """
        Find the nearest graph node to given coordinates
        
        Args:
            lat: Latitude
            lon: Longitude
            mode_filter: List of allowed modes (e.g., ['car', 'walk', 'train'])
            max_distance_km: Maximum search radius in km
            
        Returns:
            tuple: (node_id, distance_km) or (None, None) if not found
        """
        if self.graph is None:
            raise RuntimeError("Graph not loaded")
        
        nearest_node = None
        min_distance = float('inf')
        
        for node, data in self.graph.nodes(data=True):
            if 'lat' not in data or 'lon' not in data:
                continue
            
            # Filter by node type if specified
            if mode_filter:
                node_type = data.get('node_type', '')
                # Check if node connects to allowed modes
                if mode_filter == ['car'] and not node.startswith('road_'):
                    continue
                elif 'car' not in mode_filter and node.startswith('road_'):
                    continue
            
            distance = self.haversine_distance(lat, lon, data['lat'], data['lon'])
            
            if distance < min_distance and distance <= max_distance_km:
                min_distance = distance
                nearest_node = node
        
        if nearest_node is None:
            return None, None
        
        return nearest_node, min_distance
    
    def filter_graph_by_modes(self, enabled_modes):
        """
        Create a subgraph containing only edges with enabled modes
        
        Args:
            enabled_modes: List of mode strings (e.g., ['car', 'walk', 'train'])
            
        Returns:
            NetworkX graph view with filtered edges
        """
        if self.graph is None:
            raise RuntimeError("Graph not loaded")
        
        # Always include walk for short connections (< 0.5km)
        modes_with_walk = set(enabled_modes)
        
        # Check if graph is a multigraph
        is_multigraph = isinstance(self.graph, (nx.MultiGraph, nx.MultiDiGraph))
        
        # Filter edges based on graph type
        if is_multigraph:
            filtered_edges = [
                (u, v, k) for u, v, k, data in self.graph.edges(keys=True, data=True)
                if data.get('mode') in modes_with_walk or 
                   (data.get('mode') == 'walk' and data.get('distance', 999) < 0.5)
            ]
        else:
            filtered_edges = [
                (u, v) for u, v, data in self.graph.edges(data=True)
                if data.get('mode') in modes_with_walk or 
                   (data.get('mode') == 'walk' and data.get('distance', 999) < 0.5)
            ]
        
        return self.graph.edge_subgraph(filtered_edges)
    
    def get_edge_data_between_nodes(self, node1, node2):
        """Get all edge data between two nodes (for multigraphs)"""
        if self.graph is None:
            raise RuntimeError("Graph not loaded")
        
        try:
            edges = self.graph[node1][node2]
            return edges
        except KeyError:
            return None
    
    def get_node_coordinates(self, node_id):
        """Get lat/lon coordinates for a node"""
        if self.graph is None:
            raise RuntimeError("Graph not loaded")
        
        node_data = self.graph.nodes.get(node_id, {})
        return {
            'lat': node_data.get('lat'),
            'lon': node_data.get('lon')
        }
    
    def calculate_route_metrics(self, path):
        """
        Calculate total distance, time, and emissions for a route path
        
        Args:
            path: List of node IDs representing the route
            
        Returns:
            dict with total_distance, total_time, total_emissions, segments
        """
        if self.graph is None:
            raise RuntimeError("Graph not loaded")
        
        total_distance = 0
        total_time = 0
        total_emissions = 0
        segments = []
        modes_used = set()
        
        # Check if graph is a multigraph
        is_multigraph = isinstance(self.graph, (nx.MultiGraph, nx.MultiDiGraph))
        
        for i in range(len(path) - 1):
            from_node = path[i]
            to_node = path[i + 1]
            
            # Get edge data based on graph type
            if is_multigraph:
                edges = self.graph[from_node][to_node]
                
                # If multiple edges exist, pick the one with minimum emissions
                if len(edges) > 1:
                    best_edge = min(edges.items(), key=lambda x: x[1].get('emissions', float('inf')))
                    edge_data = best_edge[1]
                else:
                    edge_data = list(edges.values())[0]
            else:
                # For regular graphs, just get the edge data directly
                edge_data = self.graph[from_node][to_node]
            
            distance = edge_data.get('distance', 0)
            time = edge_data.get('time', 0)
            emissions = edge_data.get('emissions', 0)
            mode = edge_data.get('mode', 'unknown')
            
            # Convert units:
            # Distance: meters -> kilometers
            # Time: seconds -> minutes
            # Emissions: Fix if calculated from meters (divide by 1000)
            distance_km = distance / 1000  # Convert meters to km
            time_min = time / 60  # Convert seconds to minutes
            emissions_kg = emissions / 1000  # Fix emissions calculated from meters
            
            total_distance += distance_km
            total_time += time_min
            total_emissions += emissions_kg
            modes_used.add(mode)
            
            # Get coordinates
            from_coords = self.get_node_coordinates(from_node)
            to_coords = self.get_node_coordinates(to_node)
            
            segments.append({
                'from_node': from_node,
                'to_node': to_node,
                'from_lat': from_coords['lat'],
                'from_lon': from_coords['lon'],
                'to_lat': to_coords['lat'],
                'to_lon': to_coords['lon'],
                'mode': mode,
                'distance_km': round(distance_km, 3),
                'time_min': round(time_min, 2),
                'emissions_kg': round(emissions_kg, 4)
            })
        
        return {
            'total_distance_km': round(total_distance, 2),
            'total_time_min': round(total_time, 1),
            'total_emissions_kg': round(total_emissions, 4),
            'modes_used': list(modes_used),
            'segments': segments
        }
    
    def get_graph_stats(self):
        """Get statistics about the loaded graph"""
        if self.graph is None:
            return {"error": "Graph not loaded"}
        
        # Get unique modes
        modes = set()
        for u, v, data in self.graph.edges(data=True):
            if 'mode' in data:
                modes.add(data['mode'])
        
        return {
            'total_nodes': self.graph.number_of_nodes(),
            'total_edges': self.graph.number_of_edges(),
            'is_directed': self.graph.is_directed(),
            'modes_available': list(modes),
            'weakly_connected_components': nx.number_weakly_connected_components(self.graph) if self.graph.is_directed() else nx.number_connected_components(self.graph)
        }


# Singleton instance
_graph_service_instance = None

def get_graph_service(graph_path=None):
    """Get or create the singleton GraphService instance"""
    global _graph_service_instance
    if _graph_service_instance is None:
        _graph_service_instance = GraphService(graph_path)
    return _graph_service_instance