const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../server"); // You must export app from server.js
const User = require("../models/User");
const Trip = require("../models/Trip");

// Mock emission calculator to avoid requiring utils
jest.mock("../utils/emissionsCalculator", () => ({
    calculateEmission: jest.fn(() => 0.5)
}));

let mongoServer;
let token;
let userId;
let startedTripId;

beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);

    // Register a test user
    await request(app).post("/api/auth/register").send({
        name: "Test User",
        username: "testuser1",
        email: "trip@test.com",
        password: "password123"
    });

    // Login the test user
    const loginRes = await request(app).post("/api/auth/login").send({
        email: "trip@test.com",
        password: "password123"
    });

    token = loginRes.body.token;

    const user = await User.findOne({ email: "trip@test.com" });
    userId = user._id.toString();
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

describe("Trip API Tests", () => {
    // START TRIP ------------------------------------------------------
    test("Start a trip", async () => {
        const res = await request(app)
            .post("/api/trips/start")
            .set("Authorization", `Bearer ${token}`)
            .send({
                transportMode: "car"
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.tripId).toBeDefined();

        startedTripId = res.body.tripId;
    });

    
   

    // GET TRIP BY ID --------------------------------------------------
    test("Get trip by ID", async () => {
        const res = await request(app)
            .get(`/api/trips/${startedTripId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.trip).toBeDefined();
        expect(res.body.trip._id.toString()).toBe(startedTripId);
    });

    // GET ALL TRIPS ---------------------------------------------------
    test("Get all trips for user", async () => {
        const res = await request(app)
            .get("/api/trips")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.trips)).toBe(true);
        expect(res.body.count).toBeGreaterThan(0);
    });

    // EDGE CASES -------------------------------------------------------

    test("Start trip should fail without transportMode", async () => {
        const res = await request(app)
            .post("/api/trips/start")
            .set("Authorization", `Bearer ${token}`)
            .send({});

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/Transport mode/i);
    });

    test("End trip should fail with wrong tripId", async () => {
        const res = await request(app)
            .post("/api/trips/end")
            .set("Authorization", `Bearer ${token}`)
            .send({
                tripId: "65a111111111111111111111",
                distanceKm: 10
            });

        expect(res.statusCode).toBe(404);
    });

    test("Get trip by ID should fail with invalid id", async () => {
        const res = await request(app)
            .get("/api/trips/invalid-id")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(500);
    });
});
