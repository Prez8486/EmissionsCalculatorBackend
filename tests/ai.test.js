/**
 * @file ai.test.js
 * AI API Unit Tests
 */

const request = require("supertest");
const express = require("express");

// Mock the AI controller
jest.mock("../controllers/aiController", () => ({
    predictTransportMode: jest.fn(),
    checkAIHealth: jest.fn()
}));

// Mock auth middleware so it always passes
jest.mock("../middleware/authMiddleware", () => (req, res, next) => {
    req.user = { id: "fakeUserId123" }; // inject fake token user
    next();
});

const AIController = require("../controllers/aiController");
const routes = require("../routes/ai");

// Build mini express app for test
const app = express();
app.use(express.json());
app.use("/api/ai", routes);

describe("?? AI API Tests", () => {

    // --------------------------------------------------
    // 1. HEALTH CHECK
    // --------------------------------------------------
    test("? GET /api/ai/health returns AI service status", async () => {
        // Mock the controller response
        AIController.checkAIHealth.mockImplementation((req, res) => {
            return res.status(200).json({
                status: "ok",
                message: "AI service running"
            });
        });

        const res = await request(app).get("/api/ai/health");

        expect(res.status).toBe(200);
        expect(res.body.status).toBe("ok");
        expect(res.body.message).toMatch(/running/i);
    });

    // --------------------------------------------------
    // 2. PREDICT — SUCCESS
    // --------------------------------------------------
    test("?? POST /api/ai/predict returns predicted transport mode", async () => {
        AIController.predictTransportMode.mockImplementation((req, res) => {
            return res.status(200).json({
                mode: "car",
                confidence: 0.92
            });
        });

        const res = await request(app)
            .post("/api/ai/predict")
            .send({
                accelerometer: [0.1, 0.04, 0.02],
                gyroscope: [1.2, 0.5, 0.3]
            });

        expect(res.status).toBe(200);
        expect(res.body.mode).toBe("car");
        expect(res.body.confidence).toBeGreaterThan(0.8);
    });

    // --------------------------------------------------
    // 3. PREDICT — MISSING BODY DATA
    // --------------------------------------------------
    test("? POST /api/ai/predict missing sensor data returns 400", async () => {
        AIController.predictTransportMode.mockImplementation((req, res) => {
            return res.status(400).json({
                error: "Sensor data missing"
            });
        });

        const res = await request(app)
            .post("/api/ai/predict")
            .send({}); // no data

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/missing/i);
    });

    // --------------------------------------------------
    // 4. PREDICT — SERVER ERROR
    // --------------------------------------------------
    test("?? AI prediction error returns 500", async () => {
        AIController.predictTransportMode.mockImplementation((req, res) => {
            return res.status(500).json({
                error: "AI model crashed"
            });
        });

        const res = await request(app)
            .post("/api/ai/predict")
            .send({
                accelerometer: [1, 2, 3],
                gyroscope: [4, 5, 6]
            });

        expect(res.status).toBe(500);
        expect(res.body.error).toMatch(/crashed/i);
    });

});
