const request = require("supertest");
const app = require("../server");
const User = require("../models/User");
const { connectDB, clearDB, closeDB } = require("./testUtils");

beforeAll(async () => await connectDB());
afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe("?? Auth API Tests", () => {
    test("Register a new user", async () => {
        const res = await request(app)
            .post("/api/auth/register")
            .send({
                name: "Test User",
                username: "test user",
                email: "test@example.com",
                password: "hello123",
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.message).toMatch(/registered/i);

        const found = await User.findOne({ email: "test@example.com" });
        expect(found).not.toBeNull();
    });

    test("Login returns JWT token", async () => {
        await request(app).post("/api/auth/register").send({
            name: "Test User",
            username: "test user",
            email: "test2@example.com",
            password: "hello123",
        });

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "test2@example.com", password: "hello123" });

        expect(res.statusCode).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    test("Reject login with wrong password", async () => {
        await request(app).post("/api/auth/register").send({
            name: "Test User",
            username: "test user",
            email: "wrong@example.com",
            password: "hello123",
        });

        const res = await request(app)
            .post("/api/auth/login")
            .send({ email: "wrong@example.com", password: "NOPE" });

        expect(res.statusCode).toBe(401);
    });
});
