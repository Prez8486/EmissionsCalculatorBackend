jest.mock("axios");
const axios = require("axios");
const request = require("supertest");
const app = require("../server");
const User = require("../models/User");
const Emission = require("../models/Emission");
const { connectDB, clearDB, closeDB } = require("./testUtils");

let token;
let userId;

beforeAll(async () => {
    await connectDB();

    // Register & login a user
    await request(app).post("/api/auth/register").send({
        name: "Emission User",
        username: "emission123",
        email: "emission@test.com",
        password: "password123",
    });

    const login = await request(app).post("/api/auth/login").send({
        email: "emission@test.com",
        password: "password123",
    });

    token = login.body.token;
    userId = login.body.user.id;
});

afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe(" Emissions API Tests", () => {
    test("Car emissions - mocked API call", async () => {
        axios.post.mockResolvedValue({
            data: { co2_kg: 1.23 },
        });

        const res = await request(app)
            .post("/api/emissions/car/emissions")
            .send({
                vehicleMake: "Toyota",
                vehicleModel: "Corolla",
                distanceKm: 10,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.co2_kg).toBe(1.23);
    });

    test("Bus emissions calculation", async () => {
        const res = await request(app)
            .post("/api/emissions/bus/emissions")
            .send({ distanceKm: 100 });

        expect(res.statusCode).toBe(200);
        expect(res.body.emissionKg).toBeCloseTo(0.01);
    });

    test("Metro emissions calculation", async () => {
        const res = await request(app)
            .post("/api/emissions/metro/emissions")
            .send({ distanceKm: 100 });

        expect(res.statusCode).toBe(200);
        expect(res.body.emissionKg).toBeCloseTo(0.006);
    });

    test("Tram emissions calculation", async () => {
        const res = await request(app)
            .post("/api/emissions/tram/emissions")
            .send({ distanceKm: 100 });

        expect(res.statusCode).toBe(200);
        expect(res.body.emissionKg).toBeCloseTo(0.007);
    });

    test("Flight emissions - mocked", async () => {
        axios.post.mockResolvedValue({
            data: { co2_kg: 50 },
        });

        const res = await request(app)
            .post("/api/emissions/flight/emissions")
            .set("Authorization", `Bearer ${token}`)
            .send({
                fromAirport: "MEL",
                toAirport: "DEL",
                passengers: 1,
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.co2_kg).toBe(50);
    });

    test("Log a new emission for authenticated user", async () => {
        const res = await request(app)
            .post("/api/emissions/log")
            .set("Authorization", `Bearer ${token}`)
            .send({
                transportMode: "car",
                distanceKm: 20,
                emissionKg: 2.0,
                vehicleMake: "Honda",
                vehicleModel: "Civic",
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toMatch(/saved/i);

        const saved = await Emission.findOne({ userId });
        expect(saved).not.toBeNull();
        expect(saved.emissionKg).toBe(2.0);
    });

    test("Fetch emissions history", async () => {
        await Emission.create({
            userId,
            transportMode: "car",
            distanceKm: 10,
            emissionKg: 1,
            date: new Date(),
        });

        const res = await request(app)
            .get("/api/emissions/history")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.records)).toBe(true);
        expect(res.body.records.length).toBe(1);
    });

    test("Fetch leaderboard", async () => {
        await Emission.create({
            userId,
            transportMode: "car",
            distanceKm: 10,
            emissionKg: 5,
            date: new Date(),
        });

        const res = await request(app)
            .get("/api/emissions/leaderboard")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.leaderboard)).toBe(true);
    });
});
