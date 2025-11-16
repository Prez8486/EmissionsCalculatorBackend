/**
 * @file greenRoutes.test.js
 * Tests for Green Route Controller
 */

const request = require("supertest");
const express = require("express");

// Load controller & routes
const router = require("../routes/green_routes");

// Mock Python bridge + geo utils
jest.mock("../utils/pythonBridge", () => ({
    getPythonBridge: jest.fn(() => ({
        calculateRoutes: jest.fn(async () => ({
            status: "success",
            snap_info: {},
            show_alternative: true,
            greenest_rejected_reason: null,
            routes: {
                fastest: {
                    summary: {
                        total_time_min: 10,
                        total_emissions_kg: 1.2,
                        segments: [
                            { from_lat: -37.8, from_lon: 145.0, to_lat: -37.81, to_lon: 145.01, mode: "car" }
                        ]
                    }
                },
                greenest: {
                    summary: {
                        total_time_min: 12,
                        total_emissions_kg: 0.4,
                        total_distance_km: 3.5,
                        modes_used: ["walk"],
                        segments: [
                            { from_lat: -37.8, from_lon: 145.0, to_lat: -37.81, to_lon: 145.01, mode: "walk" }
                        ]
                    }
                }
            }
        })),
        getGraphStats: jest.fn(async () => ({
            status: "success",
            stats: { nodes: 1200, edges: 3500 }
        })),
        test: jest.fn(async () => ({
            success: true,
            stats: { ping: "ok" }
        }))
    }))
}));

jest.mock("../utils/geoUtils", () => ({
    validateCoordinates: jest.fn(() => true),
    haversineDistance: jest.fn(() => 1.2)
}));

// Build test app
const app = express();
app.use(express.json());
app.use("/api/routes", router);

describe("Green Routes API Tests", () => {

    // -------------------------
    // 1. VALIDATION TESTS
    // -------------------------

    test("Missing start/destination returns 400", async () => {
        const res = await request(app)
            .post("/api/routes/calculate")
            .send({ start: null, destination: null });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Missing required fields/);
    });

    test("Invalid transport mode throws error", async () => {
        const res = await request(app)
            .post("/api/routes/calculate")
            .send({
                start: [-37.8, 145.0],
                destination: [-37.81, 145.01],
                enabled_modes: ["car", "rocket"]  // INVALID
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Invalid transport modes/);
    });

    test("No modes enabled returns 400", async () => {
        const res = await request(app)
            .post("/api/routes/calculate")
            .send({
                start: [-37.8, 145.0],
                destination: [-37.81, 145.01],
                enabled_modes: []
            });

        expect(res.status).toBe(400);
    });

    // -------------------------
    // 2. SUCCESS TEST
    // -------------------------

    /*test("Successful route calculation returns formatted routes", async () => {
        const res = await request(app)
            .post("/api/routes/calculate")
            .send({
                start: [-37.8, 145.0],
                destination: [-37.81, 145.01],
                enabled_modes: ["car", "walk"]
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("success");
        expect(res.body.routes.fastest).toBeDefined();
        expect(res.body.routes.greenest).toBeDefined();
        expect(res.body.routes.greenest.summary.total_emissions_kg).toBe(0.4);
    });*/

    // -------------------------
    // 3. GRAPH STATS TEST
    // -------------------------

    test("Graph stats returns stats object", async () => {
        const res = await request(app).get("/api/routes/graph-stats");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("success");
        expect(res.body.stats.nodes).toBe(1200);
    });

    // -------------------------
    // 4. TEST PYTHON BRIDGE CONNECTION
    // -------------------------

    test("Python bridge test returns success", async () => {
        const res = await request(app).get("/api/routes/test-connection");

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/working correctly/);
    });

    // -------------------------
    // 5. POST TRIP ANALYSIS
    // -------------------------

    test("Missing fields in post-trip-analysis returns 400", async () => {
        const res = await request(app)
            .post("/api/routes/post-trip-analysis")
            .send({
                trip_id: null,
                actual_route: []
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Missing required fields/);
    });

    test("Successful post-trip analysis returns comparison", async () => {
        const res = await request(app)
            .post("/api/routes/post-trip-analysis")
            .send({
                trip_id: "12345",
                actual_route: [
                    { lat: -37.8, lon: 145.0 },
                    { lat: -37.81, lon: 145.01 }
                ],
                actual_emissions: 2.5
            });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("success");
        expect(res.body.greenest_alternative.emissions_kg).toBeDefined();
        expect(res.body.comparison.emissions_saved_kg).toBeDefined();
    });

});
