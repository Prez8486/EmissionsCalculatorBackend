const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const auth = require("../middleware/authMiddleware");

// Create a new post
router.post("/", auth, async (req, res) => {
    try {
        const post = await Post.create({
            user: req.user.id,
            content: req.body.content,
            image: req.body.image || null
        });
        res.json({ success: true, post });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get feed (latest posts)
router.get("/", auth, async (req, res) => {
    try {
        const posts = await Post.find()
            .populate("user", "name email")
            .sort({ createdAt: -1 });

        res.json({ success: true, posts });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Like/Unlike a post
router.post("/:id/like", auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        const userId = req.user.id;

        if (!post) return res.status(404).json({ success: false, message: "Post not found" });

        if (post.likes.includes(userId)) {
            post.likes = post.likes.filter(id => id.toString() !== userId);
        } else {
            post.likes.push(userId);
        }

        await post.save();
        res.json({ success: true, likes: post.likes.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
// Share Trip Post
router.post("/share-trip", auth, async (req, res) => {
    try {
        const { mode, distanceKm, emissionKg } = req.body;

        const content =
            `Completed a ${ mode } trip!\n `+
            `• Distance: ${ distanceKm } km\n `+
            `• Emissions: ${ emissionKg.toFixed(2) } kg CO?`;

        const post = await Post.create({
            user: req.user.id,
            content,
            image: req.body.image || null
        });

        res.json({ success: true, post });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;