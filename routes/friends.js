const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/authMiddleware");  

// Send a friend request
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

        // Add each other as friends
        if (!user.friends.includes(friend._id)) user.friends.push(friend._id);
        if (!friend.friends.includes(user._id)) friend.friends.push(user._id);

        // Remove from requests
        user.friendRequests = user.friendRequests.filter(
            (id) => id.toString() !== friend._id.toString()
        );

        await user.save();
        await friend.save();

        res.json({ message: "Friend request accepted" });
    } catch (err) {
        console.error("Error accepting friend request:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get friend list
router.get("/list", auth, async (req, res) => {
    const user = await User.findById(req.user.id).populate("friends", "name email");
    res.json({ friends: user.friends });
});
router.get("/requests", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("friendRequests", "name email");

        res.json({ pendingRequests: user.friendRequests || [] });
    } catch (err) {
        console.error("Get requests error:", err);
        res.status(500).json({ error: err.message });
    }
});
router.get("/all", auth, async (req, res) => {
    try {
        const users = await User.find({ _id: { $ne: req.user.id } })
            .select("name email friends friendRequests");

        res.json(users);
    } catch (err) {
        console.error("Error fetching all users:", err);
        res.status(500).json({ error: "Server error" });
    }
});
// Cancel a sent friend request
// Cancel a sent friend request
router.delete("/cancel/:friendId", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const friend = await User.findById(req.params.friendId);

        if (!friend) return res.status(404).json({ error: "User not found" });

        // 1?? Remove sender (user) from receiver's friendRequests array
        friend.friendRequests = friend.friendRequests.filter(
            id => id.toString() !== user._id.toString()
        );

        // 2?? Optionally, remove receiver from sender's "sent requests" array
        // (only if you’re tracking it — but safe to clean up either way)
        if (user.sentRequests) {
            user.sentRequests = user.sentRequests.filter(
                id => id.toString() !== friend._id.toString()
            );
        }

        // 3?? Save both documents
        await friend.save();
        await user.save();

        res.json({ message: "Friend request cancelled successfully" });
    } catch (err) {
        console.error("Cancel request error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;