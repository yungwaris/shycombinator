import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract real client IP — respects Vercel/Cloudflare proxy headers
    const ip =
      req.headers.get("x-real-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const MODAL_WEBHOOK_URL = "https://yungwaris--shycombinator-director-process-video.modal.run";

    const response = await fetch(MODAL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Forward url + email + real IP to Modal
      body: JSON.stringify({ ...body, _ip: ip }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to connect to the processing engine." },
      { status: 500 }
    );
  }
}