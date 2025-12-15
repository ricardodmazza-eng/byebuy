export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(request) });
    }

    // Only handle POST /plan
    if (url.pathname !== "/plan") {
      return new Response("OK", { status: 200, headers: corsHeaders(request) });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(request),
      });
    }

    const body = await request.json().catch(() => ({}));
    const retailer = (body.retailer || "").toString().slice(0, 80);
    const item = (body.item || "").toString().slice(0, 120);
    const purchaseDate = (body.purchaseDate || "").toString().slice(0, 20);
    const reason = (body.reason || "").toString().slice(0, 80);
    const notes = (body.notes || "").toString().slice(0, 240);

    if (!retailer || !item) {
      return json({ plan: "Missing retailer or item." }, request);
    }

    const prompt = [
      "Generate a ByeBuy return plan.",
      "",
      `Retailer: ${retailer}`,
      `Item: ${item}`,
      `Purchase date: ${purchaseDate || "Unknown"}`,
      `Reason: ${reason || "Unknown"}`,
      `Notes: ${notes || "None"}`,
      "",
      "Output MUST be in this exact format:",
      "POLICY ASSUMPTION:",
      "DEADLINE RISK:",
      "STEP-BY-STEP PLAN:",
      "PICKUP SUGGESTION:",
      "TRACKING MILESTONES:",
      "",
      "Rules:",
      "- If policy is unknown, state a reasonable assumption and label it as an assumption.",
      "- Keep it concise and consumer-friendly.",
    ].join("\n");

    const aiResp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You are ByeBuy Return Plan Generator. " +
              "Generate concise, structured return plans. " +
              "Follow the output format exactly.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      return json({ plan: "API error generating plan. Try again." }, request);
    }

    const data = await aiResp.json();
    const plan = data.output_text || "No text generated.";
    return json({ plan }, request);
  },
};

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(obj, request) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(request) },
  });
}
