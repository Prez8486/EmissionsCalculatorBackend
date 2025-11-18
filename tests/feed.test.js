const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../server");           // Your Express app
const Post = require("../models/Post");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

let mongoServer;
let token;
let userId;

beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    await mongoose.connect(uri);

    // Create test user
    const user = await User.create({
        name: "Test User",
        email: "test@example.com",
        password: "password123"
    });

    userId = user._id.toString();

    // Create JWT token
    token = jwt.sign({ id: userId }, process.env.JWT_SECRET || "testsecret", {
        expiresIn: "1h"
    });
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
            .post("/feed")
            .set("Authorization", `Bearer ${token}`)
            .send({ content: "Hello world!" });

        expect(res.body.success).toBe(true);
        expect(res.body.post.content).toBe("Hello world!");
        expect(res.body.post.user).toBe(userId);
    });

    it("should reject if no token is provided", async () => {
        const res = await request(app)
            .post("/feed")
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
            .get("/feed")
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
            .post(`/feed/${post._id}/like`)
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
            .post(`/feed/${post._id}/like`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.success).toBe(true);
        expect(res.body.likes).toBe(0);
    });

    it("should return 404 if post does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .post(`/feed/${fakeId}/like`)
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
            .post("/feed/share-trip")
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
            .post("/feed/share-trip")
            .set("Authorization", `Bearer ${token}`)
            .send({
                distance: "invalid"
            });

        expect(res.statusCode).toBe(500);
    });
});
