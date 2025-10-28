const express = require("express");
const router = express.Router();
const crypto = require("crypto");


const DEV_ID = "3003702";
const API_KEY = "e92d0392-5ea3-4538-99f9-307b44b46aec";
const BASE_URL = "https://timetableapi.ptv.vic.gov.au";
const auth = require("../middleware/authMiddleware");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function generateSignature(path) {
    // Path must start with '/' (e.g. '/v3/departures/route_type/0/stop/1071')
    const raw = path + "?devid=" + DEV_ID;
    const signature = crypto
        .createHmac("sha1", API_KEY)
        .update(raw)
        .digest("hex")
        .toUpperCase();

    return signature;
}

// Example endpoint to get departures
router.get("/departures/:routeType/:stopId", async (req, res) => {
    try {
        const { routeType, stopId } = req.params;
        const path = `/v3/departures/route_type/${ routeType }/stop/${ stopId }`;
        const signature = generateSignature(path);
        const url = `${ BASE_URL }${ path }?devid=${ DEV_ID }&signature=${ signature }`;
        console.log(url);
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("PTV fetch error:", err);
        res.status(500).json({ error: "Failed to fetch PTV data" });
    }
});
router.get("/stops/search/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const path = `/v3/search/${encodeURIComponent(name)}`;
        const signature = generateSignature(path);
        const url = `${BASE_URL}${path}?devid=${DEV_ID}&signature=${signature}`;

        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok) return res.status(500).json({ error: "PTV Search failed", details: data });

        // Filter only stops (ignore routes)
        const stops = (data.stops || []).map(s => ({
            stop_id: s.stop_id,
            stop_name: s.stop_name,
            route_type: s.route_type
        }));

        res.json(stops);
    } catch (err) {
        console.error("PTV stop search error:", err);
        res.status(500).json({ error: "Failed to search stops", message: err.message });
    }
});


// ? Get route info (to get route name)
router.get("/route/:routeId", async (req, res) => {
    try {
        const { routeId } = req.params;
        const path = `/v3/routes/${routeId}`;
        const signature = generateSignature(path);
        const url = `${BASE_URL}${path}?devid=${DEV_ID}&signature=${signature}`;

        const response = await fetch(url);
        const data = await response.json();
        res.json(data.route || {});
    } catch (err) {
        console.error("PTV route info error:", err);
        res.status(500).json({ error: "Failed to fetch route info", message: err.message });
    }
});
router.get("/stops/:stopId/:routeType", async (req, res) => {
    try {
        const { stopId, routeType } = req.params;
        const path =`/v3/stops/${stopId}/route_type/${routeType}?devid=${DEV_ID }`;
        const signature = generateSignature(path);

        const response = await fetch(
           `https://timetableapi.ptv.vic.gov.au${path}&signature=${signature}`
        );
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("PTV stop fetch failed:", err);
        res.status(500).json({ error: "PTV API error" });
    }
});
module.exports = router;
