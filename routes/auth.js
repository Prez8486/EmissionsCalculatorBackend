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
router.get("/find", auth, async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: "Email is required" });

        const user = await User.findOne({ email }).select("name email _id");
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json(user);
    } catch (err) {
        console.error("Error finding user:", err);
        res.status(500).json({ error: "Server error" });
    }
});
router.post('/car', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { make, model, extraLoad } = req.body;

        if (!make || !model) {
            return res.status(400).json({ error: 'Make and model are required.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        user.car = { make, model, extraLoad };
        await user.save();

        res.json({ message: 'Car details saved successfully', car: user.car });
    } catch (error) {
        console.error('Error saving car:', error);
        res.status(500).json({ error: 'Failed to save car details' });
    }
});

// Get saved car details
router.get('/car', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ car: user.car });
    } catch (error) {
        console.error('Error fetching car:', error);
        res.status(500).json({ error: 'Failed to fetch car details' });
    }
});







module.exports = router;
