const request = require("supertest");
const app = require("../server");
const User = require("../models/User");
const { connectDB, clearDB, closeDB } = require("./testUtils");

let tokenA, tokenB, userAId, userBId;

beforeAll(async () => {
    await connectDB();

    await request(app).post("/api/auth/register").send({
        name: "Alice",
        username: "alice",
        email: "alice@test.com",
        password: "pass123",
    });

    await request(app).post("/api/auth/register").send({
        name: "Bob",
        username: "bob",
        email: "bob@test.com",
        password: "pass123",
    });

    const loginA = await request(app).post("/api/auth/login").send({
        email: "alice@test.com",
        password: "pass123",
    });

    const loginB = await request(app).post("/api/auth/login").send({
        email: "bob@test.com",
        password: "pass123",
    });

    tokenA = loginA.body.token;
    tokenB = loginB.body.token;

    userAId = (await User.findOne({ email: "alice@test.com" }))._id;
    userBId = (await User.findOne({ email: "bob@test.com" }))._id;
});

afterEach(async () => await clearDB());
afterAll(async () => await closeDB());

describe("?? Friends API Tests", () => {
    test("User A sends friend request to B", async () => {
        const res = await request(app)
            .post(`/api/friends/request/${userBId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.statusCode).toBe(200);
    });

    test("Cannot send friend request to yourself", async () => {
        const res = await request(app)
            .post(`/api/friends/request/${userAId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.statusCode).toBe(404);
    });
});
