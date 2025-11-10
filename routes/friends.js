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

        // 1?? Remove sender (user) from receiver’s incoming friendRequests
        friend.friendRequests = friend.friendRequests.filter(
            id => id.toString() !== user._id.toString()
        );

        // 2?? Remove receiver from sender’s sentRequests, if that field exists
        if (user.sentRequests) {
            user.sentRequests = user.sentRequests.filter(
                id => id.toString() !== friend._id.toString()
            );
        }

        // 3?? Also double-check in case old data had user in friendRequests accidentally
        user.friendRequests = user.friendRequests.filter(
            id => id.toString() !== friend._id.toString()
        );

        await friend.save();
        await user.save();

        res.json({ message: "? Friend request cancelled successfully" });
    } catch (err) {
        console.error("Cancel request error:", err);
        res.status(500).json({ error: err.message });
    }
});
// Remove a friend
router.delete('/remove/:friendId', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const friendId = req.params.friendId;

        // Remove friendId from user's list
        await User.findByIdAndUpdate(userId, { $pull: { friends: friendId } });
        // Remove userId from friend's list
        await User.findByIdAndUpdate(friendId, { $pull: { friends: userId } });

        res.status(200).json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error('Error removing friend:', error);
        res.status(500).json({ message: 'Server error while removing friend' });
    }
});

module.exports = router;