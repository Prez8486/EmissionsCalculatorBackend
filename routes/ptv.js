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
        const url = `${ BASE_URL }${ path }?devid = ${ DEV_ID }& signature=${ signature }`;
        console.log(url);
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.error("PTV fetch error:", err);
        res.status(500).json({ error: "Failed to fetch PTV data" });
    }
});

module.exports = router;
