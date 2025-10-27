const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const auth = require("../middleware/authMiddleware");   
const User = require("../models/User");
const bcrypt = require("bcryptjs");

router.post("/register", register);
router.post("/login", login);
// Change password (user must be logged in)
router.post("/change-password", auth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        console.log("Request body:", req.body);
        const user = await User.findById(req.user.id);
        console.log("User found:", user ? user.email : "none");
        if (!user) return res.status(404).json({ error: "User not found" });

        // Check old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: "Old password is incorrect" });

        // Update to new password
        const hashed = await bcrypt.hash(newPassword, 10);
        user.password = hashed;
        await user.save();

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error("Change password error:", err.message);
        res.status(500).json({ error: "Failed to change password" });
    }
});
router.post("/request/:friendId", auth, async (req, res) => {
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
router.post("/accept/:friendId", auth, async (req, res) => {
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
router.get("/list", auth, async (req, res) => {
    const user = await User.findById(req.user.id).populate("friends", "name email");
    res.json({ friends: user.friends });
});
const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    car: {
        make: { type: String, default: '' },
        model: { type: String, default: '' },
        extraLoad: { type: String, default: 'none' },

    }

});




module.exports = router;
