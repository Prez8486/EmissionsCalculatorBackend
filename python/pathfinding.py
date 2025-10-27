"""
Pathfinding Service - Calculate optimal routes using NetworkX
"""
import sys
import json
import networkx as nx
from graph_service import get_graph_service


def calculate_routes(start_lat, start_lon, dest_lat, dest_lon, enabled_modes, max_time_variance_percent=20):
    """
    Calculate fastest and greenest routes between two points
    
    Args:
        start_lat: Starting latitude
        start_lon: Starting longitude
        dest_lat: Destination latitude
        dest_lon: Destination longitude
        enabled_modes: List of enabled transport modes
        max_time_variance_percent: Maximum time increase for greenest route
        
    Returns:
        dict with route data or error
    """
    try:
        # Get graph service
        graph_service = get_graph_service()
        
        # Step 1: Find nearest nodes
        start_node, start_dist = graph_service.find_nearest_node(
            start_lat, start_lon, 
            mode_filter=enabled_modes,
            max_distance_km=2.0
        )
        
        if start_node is None:
            return {
                'status': 'error',
                'message': 'Could not find nearby start location on transport network',
                'suggestion': 'Try a different starting point or enable more transport modes'
            }
        
        dest_node, dest_dist = graph_service.find_nearest_node(
            dest_lat, dest_lon,
            mode_filter=enabled_modes,
            max_distance_km=2.0
        )
        
        if dest_node is None:
            return {
                'status': 'error',
                'message': 'Could not find nearby destination on transport network',
                'suggestion': 'Try a different destination or enable more transport modes'
            }
        
        # Step 2: Filter graph by enabled modes
        filtered_graph = graph_service.filter_graph_by_modes(enabled_modes)
        
        if filtered_graph.number_of_edges() == 0:
            return {
                'status': 'error',
                'message': 'No routes available with selected transport modes',
                'suggestion': 'Please enable at least one transport mode'
            }
        
        # Step 3: Calculate fastest route (by time)
        try:
            fastest_path = nx.shortest_path(
                filtered_graph,
                source=start_node,
                target=dest_node,
                weight='time'
            )
            fastest_metrics = graph_service.calculate_route_metrics(fastest_path)
        except nx.NetworkXNoPath:
            return {
                'status': 'error',
                'message': 'No route found between start and destination',
                'suggestion': 'Try enabling more transport modes or check if locations are accessible',
                'debug': {
                    'start_node': start_node,
                    'dest_node': dest_node,
                    'enabled_modes': enabled_modes
                }
            }
        except Exception as e:
            return {
                'status': 'error',
                'message': f'Error calculating fastest route: {str(e)}'
            }
        
        # Step 4: Calculate greenest route (by emissions)
        try:
            greenest_path = nx.shortest_path(
                filtered_graph,
                source=start_node,
                target=dest_node,
                weight='emissions'
            )
            greenest_metrics = graph_service.calculate_route_metrics(greenest_path)
        except nx.NetworkXNoPath:
            # Same error as fastest (shouldn't happen if fastest succeeded)
            greenest_path = fastest_path
            greenest_metrics = fastest_metrics
        except Exception as e:
            # Fallback to fastest route
            greenest_path = fastest_path
            greenest_metrics = fastest_metrics
        
        # Step 5: Check if greenest route is reasonable
        if fastest_metrics['total_time_min'] > 0:
            time_diff_percent = (
                (greenest_metrics['total_time_min'] - fastest_metrics['total_time_min']) 
                / fastest_metrics['total_time_min'] * 100
            )
        else:
            time_diff_percent = 0
        
        show_alternative = time_diff_percent <= max_time_variance_percent
        
        # Calculate emissions savings
        emissions_saved = fastest_metrics['total_emissions_kg'] - greenest_metrics['total_emissions_kg']
        emissions_saved_percent = (
            (emissions_saved / fastest_metrics['total_emissions_kg'] * 100) 
            if fastest_metrics['total_emissions_kg'] > 0 else 0
        )
        
        # Build response
        response = {
            'status': 'success',
            'snap_info': {
                'start_node': start_node,
                'start_distance_km': round(start_dist, 3),
                'dest_node': dest_node,
                'dest_distance_km': round(dest_dist, 3)
            },
            'routes': {
                'fastest': {
                    'path': fastest_path,
                    'summary': fastest_metrics
                }
            },
            'show_alternative': show_alternative
        }
        
        # Add greenest route if it's different and reasonable
        if fastest_path != greenest_path:
            response['routes']['greenest'] = {
                'path': greenest_path,
                'summary': greenest_metrics,
                'comparison': {
                    'time_increase_min': round(greenest_metrics['total_time_min'] - fastest_metrics['total_time_min'], 1),
                    'time_increase_percent': round(time_diff_percent, 1),
                    'emissions_saved_kg': round(emissions_saved, 4),
                    'emissions_saved_percent': round(emissions_saved_percent, 1)
                }
            }
            
            if not show_alternative:
                response['greenest_rejected_reason'] = f"Would take {round(time_diff_percent, 0)}% longer ({round(greenest_metrics['total_time_min'] - fastest_metrics['total_time_min'], 1)} min)"
        else:
            # Routes are identical
            response['routes']['greenest'] = response['routes']['fastest']
            response['routes']['greenest']['comparison'] = {
                'note': 'Fastest route is already the greenest option'
            }
        
        return response
        
    except Exception as e:
        return {
            'status': 'error',
            'message': f'Unexpected error: {str(e)}',
            'type': type(e).__name__
        }


def get_graph_stats(graph_path=None):
    """Get statistics about the loaded graph"""
    try:
        graph_service = get_graph_service(graph_path)
        stats = graph_service.get_graph_stats()
        return {
            'status': 'success',
            'stats': stats
        }
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }


if __name__ == '__main__':
    """
    Command-line interface for pathfinding
    Usage: python pathfinding.py '{"start_lat": -37.8136, "start_lon": 144.9631, ...}'
    """
    if len(sys.argv) > 1:
        try:
            # Parse JSON input
            input_data = json.loads(sys.argv[1])
            
            if input_data.get('action') == 'stats':
                result = get_graph_stats(input_data.get('graph_path'))
            else:
                result = calculate_routes(
                    start_lat=input_data['start_lat'],
                    start_lon=input_data['start_lon'],
                    dest_lat=input_data['dest_lat'],
                    dest_lon=input_data['dest_lon'],
                    enabled_modes=input_data.get('enabled_modes', ['car', 'walk', 'train', 'tram', 'bus']),
                    max_time_variance_percent=input_data.get('max_time_variance_percent', 20),
                )
            
            # Output JSON result
            print(json.dumps(result, indent=2))
            
        except json.JSONDecodeError:
            print(json.dumps({
                'status': 'error',
                'message': 'Invalid JSON input'
            }))
        except KeyError as e:
            print(json.dumps({
                'status': 'error',
                'message': f'Missing required field: {str(e)}'
            }))
        except Exception as e:
            print(json.dumps({
                'status': 'error',
                'message': str(e)
            }))
    else:
        print(json.dumps({
            'status': 'error',
            'message': 'No input provided. Expected JSON string as argument.'
        }))