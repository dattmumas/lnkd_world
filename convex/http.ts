import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { internal } from "./_generated/api";

const http = httpRouter();

auth.addHttpRoutes(http);

// Bonds dashboard data ingestion endpoint
// POST /api/bonds/ingest — accepts JSON snapshot from Python pipeline
http.route({
  path: "/api/bonds/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify sync secret
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    const syncSecret = process.env.SYNC_SECRET;

    if (!syncSecret || !token || token !== syncSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const body = await request.json();

      await ctx.runMutation(internal.bonds.ingest, {
        generatedAt: body.generated_at || new Date().toISOString(),
        version: body.version || "1.0.0",
        status: body.status || "ok",
        data: JSON.stringify(body),
      });

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: String(e) }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
