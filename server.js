const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const emissionRoutes = require("./routes/emissions");
const tripRoutes = require("./routes/trips"); 
const aiRoutes = require('./routes/ai');
const routeRoutes = require('./routes/green_routes');
const friendsRoutes = require('./routes/friends');
const ptvRoutes = require('./routes/ptv');
const feedRoutes = require('./routes/feed');

dotenv.config();

const app = express();

app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));

app.options("*", cors()); // preflight support

app.use(express.json({limit: '10mb'})); // to parse JSON bodies with increased limit
if (process.env.NODE_ENV !== "test") {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("MongoDB connected"))
        .catch(err => console.error(err));
}
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/emissions", emissionRoutes);
app.use("/api/trips", tripRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/routes', routeRoutes)
app.use('/api/friends', friendsRoutes);
app.use('/api/ptv', ptvRoutes);
app.use('/api/feed', feedRoutes);



// Basic health check route
app.get('/', (req, res) => {
    res.json({ message: 'Emissions Calculator API is running!' });
});

if (process.env.NODE_ENV !== "test") {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`?? Server running on port ${ PORT }`));
}

// Export the app (required for Jest/Supertest)
module.exports = app;