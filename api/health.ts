import type { VercelRequest, VercelResponse } from "@vercel/node";

interface ServiceStatus {
    name: string;
    status: "operational" | "degraded" | "down";
}

interface HealthResponse {
    status: "ok" | "degraded" | "down";
    services: ServiceStatus[];
    uptime: number;
}

const startTime = Date.now();

export default async function handler(_req: VercelRequest, res: VercelResponse) {
    const services: ServiceStatus[] = [];

    // Check GitHub API reachability
    try {
        const gh = await fetch("https://api.github.com", { method: "HEAD" });
        services.push({
            name: "GitHub API",
            status: gh.ok ? "operational" : "degraded",
        });
    } catch {
        services.push({ name: "GitHub API", status: "down" });
    }

    // This function itself is running → app is operational
    services.push({ name: "MicYou App", status: "operational" });

    const allOperational = services.every((s) => s.status === "operational");
    const anyDown = services.some((s) => s.status === "down");

    const body: HealthResponse = {
        status: anyDown ? "down" : allOperational ? "ok" : "degraded",
        services,
        uptime: Math.floor((Date.now() - startTime) / 1000),
    };

    res.status(allOperational ? 200 : 503).json(body);
}

