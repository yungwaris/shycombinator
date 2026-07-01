import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // seconds, adjust to your plan's max

const MODAL_WEBHOOK_URL =
  "https://yungwaris--shycombinator-director-process-video.modal.run";

const SHEET_ID = "18Dn6NeJEYcqom9NcQKRQCZBCHmehzU6ukGo8o_NLGLw";

// ── CORS ─────────────────────────────────────────────────────────
// Add every origin that needs to call this route. Framer's published
// site and its live-editor preview use different origins, so list both
// if you want to test from the editor as well as the live page.
// IMPORTANT: no trailing slashes here — browsers never send a trailing
// slash in the Origin header, so a slashed entry will never match.
const ALLOWED_ORIGINS = [
  "https://smiling-technology-410249.framer.app",
  "https://www.shycombinator.co",
];

function corsHeadersFor(origin: string | null) {
  // Only echo back the origin if it's actually in the allow-list.
  // Falling back to a hardcoded origin when there's no match sends
  // an Access-Control-Allow-Origin that doesn't match the real
  // Origin header, which the browser will reject.
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

// Handle preflight OPTIONS request
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeadersFor(origin) });
}
// ─────────────────────────────────────────────────────────────────

async function saveLeadToSheets(email: string, url: string) {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!saJson) return;

  try {
    const sa = JSON.parse(saJson);
    const now = Math.floor(Date.now() / 1000);

    const claim = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    const b64 = (obj: object) =>
      Buffer.from(JSON.stringify(obj))
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    const header = b64({ alg: "RS256", typ: "JWT" });
    const payload = b64(claim);
    const unsigned = `${header}.${payload}`;

    const pemBody = sa.private_key
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\s/g, "");

    const keyDer = Buffer.from(pemBody, "base64");
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      keyDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      Buffer.from(unsigned)
    );

    const sigB64 = Buffer.from(sig)
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    const jwt = `${unsigned}.${sigB64}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const { access_token } = await tokenRes.json();

    const timestamp = new Date().toISOString();
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1!A:C:append?valueInputOption=RAW`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [[timestamp, email, url]] }),
      }
    );
  } catch (err) {
    console.error("Sheets save failed:", err);
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeadersFor(origin);

  try {
    const body = await req.json();
    const { email, url } = body;

    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const response = await fetch(MODAL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, _ip: ip }),
    });

    const data = await response.json();

    // Save to Sheets only on successful roast
    if (data.success && email && url) {
      await saveLeadToSheets(email, url);
    }

    if (data.error) {
      return NextResponse.json(
        { error: data.error },
        { status: 400, headers }
      );
    }

    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to connect to the processing engine." },
      { status: 500, headers }
    );
  }
}