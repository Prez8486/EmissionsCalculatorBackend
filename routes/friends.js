const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");  

// Send a friend request
router.post("/request/:friendId", async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const friend = await User.findById(req.params.friendId);

        if (!friend) return res.status(404).json({ error: "User not found" });
        if (user.friends.includes(friend._id)) return res.json({ message: "Already friends" });

        if (!friend.friendRequests.includes(user._id)) {
            friend.friendRequests.push(user._id);
            await friend.save();
        }
        res.json({ message: "Friend request sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Accept friend request
router.post("/accept/:friendId", async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const friend = await User.findById(req.params.friendId);

        if (!friend) return res.status(404).json({ error: "User not found" });

        // Add both to each other’s friend lists
        user.friends.push(friend._id);
        friend.friends.push(user._id);

        // Remove from requests
        user.friendRequests = user.friendRequests.filter(
            id => id.toString() !== friend._id.toString()
        );

        await user.save();
        await friend.save();

        res.json({ message: "Friend request accepted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get friend list
router.get("/list", async (req, res) => {
    const user = await User.findById(req.user.id).populate("friends", "name email");
    res.json({ friends: user.friends });
});

module.exports = router;