import { createNodeMiddleware, createProbot } from "probot";
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "./app.js";

const probot = createProbot();
const startTime = Date.now();

let _middleware: Awaited<ReturnType<typeof createNodeMiddleware>> | null = null;

async function getMiddleware() {
	if (!_middleware) {
		_middleware = await createNodeMiddleware(app, {
			probot,
			webhooksPath: "/api/github/webhooks",
		});
	}
	return _middleware;
}

async function health(_req: IncomingMessage, res: ServerResponse) {
	const services: { name: string; status: string }[] = [];

	try {
		const gh = await fetch("https://api.github.com", { method: "HEAD" });
		services.push({ name: "GitHub API", status: gh.ok ? "operational" : "degraded" });
	} catch {
		services.push({ name: "GitHub API", status: "down" });
	}

	services.push({ name: "MicYou App", status: "operational" });

	const allOk = services.every((s) => s.status === "operational");
	const anyDown = services.some((s) => s.status === "down");

	const body = {
		status: anyDown ? "down" : allOk ? "ok" : "degraded",
		services,
		uptime: Math.floor((Date.now() - startTime) / 1000),
	};

	res.writeHead(allOk ? 200 : 503, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
	if (req.url === "/api/health" && req.method === "GET") {
		return health(req, res);
	}
	const mw = await getMiddleware();
	return mw(req, res);
}

