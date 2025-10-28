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