const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server.js");
const User = require("../models/User.js");

let mongoServer;
let tokenA, tokenB, userAId, userBId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    const regA=await request(app).post("/api/auth/register").send({
        name: "Alice",
        username: "alice",
        email: "alice@test.com",
        password: "password123",
    });
   
    const regB =await request(app).post("/api/auth/register").send({
        name: "Bob",
        username: "bob",
        email: "bob@test.com",
        password: "password123",
    });
    
    const loginA = await request(app).post("/api/auth/login").send({
        email: "alice@test.com",
        password: "password123",
    });

    const loginB = await request(app).post("/api/auth/login").send({
        email: "bob@test.com",
        password: "password123",
    });

    tokenA = loginA.body.token;
    tokenB = loginB.body.token;

    const userA = await User.findOne({ email: "alice@test.com" });
    const userB = await User.findOne({ email: "bob@test.com" });

    userAId = userA._id.toString();
    userBId = userB._id.toString();
});

afterAll(async () => {
    await mongoose.connection.close();
    await mongoServer.stop();
});

describe("Friendship API", () => {
    test("Send a friend request", async () => {
        const res = await request(app)
            .post(`/api/friends/request/${userBId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.statusCode).toBe(200);
    });

    test("Accept a friend request", async () => {
        const res = await request(app)
            .post(`/api/friends/accept/${userAId}`)
            .set("Authorization", `Bearer ${tokenB}`);

        expect(res.statusCode).toBe(200);
    });

    test("List friends of user A", async () => {
        const res = await request(app)
            .get("/api/friends/list")
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body.friends)).toBe(true);
    });

    test("Remove a friend", async () => {
        const res = await request(app)
            .delete(`/api/friends/remove/${userBId}`)
            .set("Authorization", `Bearer ${tokenA}`);

        expect(res.statusCode).toBe(200);
    });
});
