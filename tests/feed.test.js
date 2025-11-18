const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../server");
const User = require("../models/User");
const Post = require("../models/Post");

let mongoServer;
let token;
let userId;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Register the test user
    await request(app)
        .post("/api/auth/register")
        .send({
            name: "Feed User",
            username: "feeduser",
            email: "feed@test.com",
            password: "password123"
        });

    // Login to get JWT token
    const loginRes = await request(app)
        .post("/api/auth/login")
        .send({
            email: "feed@test.com",
            password: "password123"
        });

    token = loginRes.body.token;
    userId = loginRes.body.user.id;
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

afterEach(async () => {
    await Post.deleteMany();
});

// ---------------------------------------------
// TEST: Create Post
// ---------------------------------------------
describe("POST /feed", () => {
    it("should create a new post", async () => {
        const res = await request(app)
            .post("/api/feed")
            .set("Authorization", `Bearer ${token}`)
            .send({ content: "Hello world!" });

        expect(res.body.success).toBe(true);
        expect(res.body.post.content).toBe("Hello world!");
        expect(res.body.post.user).toBe(userId);
    });

    it("should reject if no token is provided", async () => {
        const res = await request(app)
            .post("/api/feed")
            .send({ content: "No token" });

        expect(res.statusCode).toBe(401);
    });
});

// ---------------------------------------------
// TEST: Get Feed
// ---------------------------------------------
describe("GET /feed", () => {
    it("should return posts sorted by newest first", async () => {
        await Post.create([
            { user: userId, content: "Post 1" },
            { user: userId, content: "Post 2" }
        ]);

        const res = await request(app)
            .get("/api/feed")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.success).toBe(true);
        expect(res.body.posts.length).toBe(2);
        expect(res.body.posts[0].content).toBe("Post 2");
    });
});

// ---------------------------------------------
// TEST: Like / Unlike
// ---------------------------------------------
describe("POST /feed/:id/like", () => {
    it("should like a post", async () => {
        const post = await Post.create({ user: userId, content: "Like test" });

        const res = await request(app)
            .post(`/api/feed/${post._id}/like`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.success).toBe(true);
        expect(res.body.likes).toBe(1);
    });

    it("should unlike a post if already liked", async () => {
        const post = await Post.create({
            user: userId,
            content: "Unlike test",
            likes: [userId]
        });

        const res = await request(app)
            .post(`/api/feed/${post._id}/like`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.success).toBe(true);
        expect(res.body.likes).toBe(0);
    });

    it("should return 404 if post does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/api/feed/${fakeId}/like`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(404);
    });
});

// ---------------------------------------------
// TEST: Share Trip
// ---------------------------------------------
describe("POST /feed/share-trip", () => {
    it("should create an auto-generated trip post", async () => {
        const res = await request(app)
            .post("/api/feed/share-trip")
            .set("Authorization", `Bearer ${token}`)
            .send({
                transportMode: "car",
                distance: 12.5,
                emission: 3.22
            });

        expect(res.body.success).toBe(true);
        expect(res.body.post.content).toContain("12.5 km");
        expect(res.body.post.content).toContain("3.22 kg CO2");
    });

    it("should return 500 on invalid input", async () => {
        const res = await request(app)
            .post("/api/feed/share-trip")
            .set("Authorization", `Bearer ${token}`)
            .send({
                distance: "invalid"
            });

        expect(res.statusCode).toBe(500);
    });
});
