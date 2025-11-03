"""
Diagnostic script to check graph edge attributes
Run: python diagnose_graph.py
"""
import pickle
import os

# Load graph
script_dir = os.path.dirname(os.path.abspath(__file__))
graph_path = os.path.join(script_dir, 'combined_graph.gpickle')

with open(graph_path, 'rb') as f:
    graph = pickle.load(f)

print("=== GRAPH DIAGNOSTICS ===\n")

# Sample 10 edges from each mode
modes = ['car', 'walk', 'train', 'tram', 'bus']
samples_per_mode = {}

for mode in modes:
    samples = []
    count = 0
    for u, v, data in graph.edges(data=True):
        if data.get('mode') == mode and count < 3:
            samples.append({
                'from': u,
                'to': v,
                'distance': data.get('distance'),
                'time': data.get('time'),
                'emissions': data.get('emissions'),
                'emissions_factor': data.get('emissions_factor')
            })
            count += 1
        if count >= 3:
            break
    samples_per_mode[mode] = samples

# Print samples
for mode, samples in samples_per_mode.items():
    if samples:
        print(f"\n{mode.upper()} edges:")
        for i, s in enumerate(samples, 1):
            print(f"  Sample {i}:")
            print(f"    From: {s['from']}")
            print(f"    To: {s['to']}")
            print(f"    Distance: {s['distance']}")
            print(f"    Time: {s['time']}")
            print(f"    Emissions: {s['emissions']}")
            print(f"    Emissions Factor: {s['emissions_factor']}")
            
            # Calculate speed
            if s['time'] and s['time'] > 0 and s['distance']:
                # Assume time in minutes
                speed_if_distance_km = (s['distance'] / s['time']) * 60  # km/h
                speed_if_distance_m = (s['distance'] / 1000 / s['time']) * 60  # km/h
                print(f"    Speed (if distance=km): {speed_if_distance_km:.1f} km/h")
                print(f"    Speed (if distance=m): {speed_if_distance_m:.1f} km/h")

print("\n=== CONCLUSIONS ===")
print("Check the speeds above:")
print("- Car should be 30-60 km/h average")
print("- Walk should be 4-5 km/h")
print("- Train/Tram should be 30-50 km/h")
print("- Bus should be 20-40 km/h")