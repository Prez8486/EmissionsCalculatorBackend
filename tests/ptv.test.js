jest.mock("node-fetch", () => jest.fn());
const fetch = require("node-fetch");
const request = require("supertest");
const app = require("../server");

// Simple mock Response for fetch
class MockResponse {
    constructor(body, status = 200) {
        this.body = body;
        this.status = status;
    }
    async json() {
        return JSON.parse(this.body);
    }
    get ok() {
        return this.status >= 200 && this.status < 300;
    }
}

describe("?? PTV API Tests (Mocked fetch)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Departures endpoint returns mocked data", async () => {
        fetch.mockResolvedValueOnce(
            new MockResponse(JSON.stringify({ departures: ["mocked"] }))
        );

        const res = await request(app).get("/api/ptv/departures/0/1071");

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(res.body.departures[0]).toBe("mocked");
    });

    test("Stop search returns mocked stops", async () => {
        fetch.mockResolvedValueOnce(
            new MockResponse(
                JSON.stringify({
                    stops: [
                        { stop_id: 1, stop_name: "Station", route_type: 0 }
                    ]
                })
            )
        );

        const res = await request(app).get("/api/ptv/stops/search/Flinders");

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(res.body[0].stop_name).toBe("Station");
    });

    test("Route info returns mocked route", async () => {
        fetch.mockResolvedValueOnce(
            new MockResponse(
                JSON.stringify({ route: { route_id: 10, route_name: "Mock Route" } })
            )
        );

        const res = await request(app).get("/api/ptv/route/10");

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(res.body.route_name).toBe("Mock Route");
    });

    test("Stops by stopId + routeType returns mocked list", async () => {
        fetch.mockResolvedValueOnce(
            new MockResponse(
                JSON.stringify({
                    stops: [{ stop_id: 55, stop_name: "Test Stop" }]
                })
            )
        );

        const res = await request(app).get("/api/ptv/stops/55/0");

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(res.body[0].stop_id).toBe(55);
    });

    test("Handles PTV API failure gracefully", async () => {
        fetch.mockRejectedValueOnce(new Error("API error"));

        const res = await request(app).get("/api/ptv/departures/0/1234");

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(500);
        expect(res.body.error).toMatch(/Failed to fetch/i);
    });
});