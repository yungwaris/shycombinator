import modal
import os
import time
import subprocess

app = modal.App("shycombinator-director")

image = (
    modal.Image.debian_slim()
    .apt_install(
        "ffmpeg",
        "nodejs",
        "chromium",
        "chromium-driver",
    )
    .pip_install(
        "yt-dlp",
        "google-genai",
        "fastapi[standard]",
        "requests",
        "httpx",
        "google-auth",
    )
    .add_local_file("cookies.txt", remote_path="/root/cookies_x.txt")
)

DIRECTOR_PROMPT = """
YYou are an expert brand critic, creative director, startup marketer, and documentary filmmaker. Analyze the video across the following 5 steps.

STEP 1: IDENTIFY VIDEO TYPE (Pick one or estimate % breakdown for TYPE 6: HYBRID)
- TYPE 1: LIVE ACTION BRAND FILM (Scripted, actors, cinematic, emotional)
- TYPE 2: FOUNDER DOCUMENTARY (Interviews, talking heads, journey, mission)
- TYPE 3: VIDEO ESSAY/ARCHIVAL FILM (Narration, archival/stock footage, graphics)
- TYPE 4: AI GENERATED FILM (AI visuals, synthetic environments, creative direction)
- TYPE 5: FOUNDER LOOM (Screen recording, product walkthrough, direct talk)

STEP 2: EVALUATE UNIVERSAL FACTORS (Rate/analyze each):
- MESSAGE: Hook, Problem Clarity, Solution Clarity, Differentiation, Audience Relevance, CTA.
- STORY: Structure, narrative progression, conflict, payoff.
- CLARITY: Logical flow, focused messaging.
- BRAND: Personality, trust, consistency, authenticity.
- RETENTION: Pacing, visual variety, curiosity loops.
- PERSUASION: Credibility, proof, objection handling.

STEP 3: EVALUATE TYPE-SPECIFIC FACTORS (Only evaluate the chosen type[s]):
- LIVE ACTION: Acting, Cinematography, Lighting, Production Design, Editing, Sound Design, Background Music, Emotional Impact.
- FOUNDER DOC: Founder Presence, Authenticity, Origin Story, Mission Clarity, Interview Quality, B-Roll Quality.
- VIDEO ESSAY: Script Quality, Narration, Research Quality, Visual Relevance, Motion Graphics, Editing Rhythm.
- AI FILM: Creative Direction, Visual Consistency, Shot Quality, AI Artifact Control, Storytelling, Emotional Impact.
- LOOM: Communication, Founder Confidence, Product Demo, Screen Recording Quality, Audio Quality, Conversion Potential.

STEP 4: DETECT PRODUCTION VS MESSAGE MISMATCH (Classify A-D):
- Case A: High production + weak message (Expensive but empty)
- Case B: Low production + strong message (Effective despite low budget)
- Case C: High production + strong message (Excellent execution)
- Case D: Low production + weak message (No value created)

STEP 5: PROCEED TO ROAST. You have to output only the Step 5. The roast should be under 200 words.
"""

# ---------------------------------------------------------------------------
# In-memory rate limiter
# key: ip or email -> last successful submission timestamp
# Only updated when a request actually reaches Gemini successfully
# ---------------------------------------------------------------------------
# Modal keeps containers warm between calls so this dict persists across
# requests on the same container instance. For a multi-container deployment
# this is best-effort (not globally consistent) but sufficient for abuse
# prevention at launch scale.
_rate_limit_store: dict[str, float] = {}
RATE_LIMIT_SECONDS = 300  # 5 minutes


def _check_rate_limit(key: str) -> float | None:
    """Returns seconds remaining if rate limited, else None."""
    last = _rate_limit_store.get(key)
    if last is None:
        return None
    elapsed = time.time() - last
    if elapsed < RATE_LIMIT_SECONDS:
        return RATE_LIMIT_SECONDS - elapsed
    return None


def _record_successful_submission(keys: list[str]) -> None:
    """Call this ONLY after video successfully reaches Gemini."""
    now = time.time()
    for key in keys:
        _rate_limit_store[key] = now


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client_ip(request_obj) -> str:
    """Extract real IP, respecting common proxy headers."""
    # FastAPI/Starlette passes the raw request via the injected parameter
    # We store it on the dict under a special key from the Next.js API route
    return "unknown"


def _detect_platform(url: str) -> str:
    url_lower = url.lower()
    if any(x in url_lower for x in ["x.com", "twitter.com"]):
        return "x"
    if any(x in url_lower for x in ["youtube.com", "youtu.be"]):
        return "youtube"
    if "linkedin.com" in url_lower:
        return "linkedin"
    if "loom.com" in url_lower:
        return "loom"
    if "vimeo.com" in url_lower:
        return "vimeo"
    if "instagram.com" in url_lower:
        return "instagram"
    if "tiktok.com" in url_lower:
        return "tiktok"
    return "generic"


def _ydl_opts_for_platform(platform: str, out_tmpl: str) -> dict:
    base = {
        "outtmpl": out_tmpl,
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best",
        "merge_output_format": "mp4",
        "retries": 3,
        "fragment_retries": 3,
        "noplaylist": True,
        "socket_timeout": 20,
    }

    if platform == "x":
        base["cookiefile"] = "/root/cookies_x.txt"
        base["format"] = "best[height<=720]/best"

    elif platform == "youtube":
        base["format"] = (
            "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]"
            "/best[height<=720][ext=mp4]/best[height<=720]/best"
        )

    elif platform == "linkedin":
        base["http_headers"] = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.linkedin.com/",
        }
        base["format"] = "best[height<=720]/best"

    elif platform in ("instagram", "tiktok"):
        base["format"] = "best[height<=720]/best"
        base["http_headers"] = {
            "User-Agent": (
                "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                "AppleWebKit/605.1.15 (KHTML, like Gecko) "
                "Version/17.0 Mobile/15E148 Safari/604.1"
            )
        }

    return base


def _compress_video(raw_path: str, out_path: str) -> bool:
    """
    Compress for Gemini video analysis with audio preserved:
    - 30s cap     -> 258 tokens/sec * 30s = ~7,740 video tokens
    - 144p        -> smallest Gemini handles cleanly
    - 5 fps       -> enough to read pacing/cuts/text on screen
    - audio @32k  -> mono, minimal bitrate — enough for voiceover/music analysis
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", raw_path,
        "-t", "30",
        "-r", "5",
        "-vf", "scale=-2:144",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "35",
        "-c:a", "aac",
        "-b:a", "32k",
        "-ac", "1",
        out_path,
    ]
    result = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return result.returncode == 0


# ---------------------------------------------------------------------------
# Modal endpoint
# ---------------------------------------------------------------------------

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("gemini-secret")],
    timeout=300,
)
@modal.fastapi_endpoint(method="POST")
def process_video(request: dict):
    import yt_dlp
    from google import genai
    import re

    video_url = request.get("url", "").strip()
    email = request.get("email", "").strip().lower()
    ip = request.get("_ip", "unknown").strip()  # passed from Next.js API route

    if not video_url:
        return {"error": "No URL provided"}
    if not email:
        return {"error": "Email is required"}

    # ------------------------------------------------------------------
    # RATE LIMIT CHECK — before any processing
    # Check both email and IP independently
    # ------------------------------------------------------------------
    for key, label in [(email, "email"), (ip, "IP")]:
        remaining = _check_rate_limit(key)
        if remaining is not None:
            mins = int(remaining // 60)
            secs = int(remaining % 60)
            return {
                "error": f"Easy there 🫡 you already submitted a video recently. Try again in {mins}m {secs}s."
            }

    platform = _detect_platform(video_url)
    raw_tmpl = "/tmp/raw_video.%(ext)s"
    processed_path = "/tmp/final_launch_video.mp4"
    raw_path = None

    # ------------------------------------------------------------------
    # 1. DOWNLOAD
    # ------------------------------------------------------------------
    ydl_opts = _ydl_opts_for_platform(platform, raw_tmpl)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(video_url, download=True)

        candidates = [f for f in os.listdir("/tmp") if f.startswith("raw_video")]
        if not candidates:
            raise FileNotFoundError("yt-dlp ran but produced no output file.")

        raw_path = f"/tmp/{candidates[0]}"

    except Exception as exc:
        return {"error": f"Download failed ({platform}): {exc}"}

    # ------------------------------------------------------------------
    # 2. COMPRESS
    # ------------------------------------------------------------------
    if not _compress_video(raw_path, processed_path):
        processed_path = raw_path

    # ------------------------------------------------------------------
    # 3. GEMINI — upload + generate
    # Rate limit is recorded ONLY if upload succeeds (reaches Gemini)
    # ------------------------------------------------------------------
    from google.genai import types

    GEMINI_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
    ]

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    uploaded_file = None

    try:
        # Upload video — if this succeeds, we've consumed API resources
        # so we record the rate limit NOW, before generate_content
        uploaded_file = client.files.upload(file=processed_path)

        max_wait = 120
        waited = 0
        while uploaded_file.state == "PROCESSING" and waited < max_wait:
            time.sleep(4)
            waited += 4
            uploaded_file = client.files.get(name=uploaded_file.name)

        if uploaded_file.state == "FAILED":
            return {"error": "Gemini rejected the video during processing."}

        # ✅ Video successfully reached Gemini — record rate limit now
        _record_successful_submission([email, ip])

        last_error = None
        for model in GEMINI_MODELS:
            for attempt in range(3):
                try:
                    response = client.models.generate_content(
                        model=model,
                        contents=[DIRECTOR_PROMPT, uploaded_file],
                    )
                    critique = response.text.strip() if response.text else None
                    if critique:
                        return {"success": True, "critique": critique, "model_used": model}
                    last_error = f"{model} returned empty response"
                    break

                except Exception as exc:
                    exc_str = str(exc)
                    is_quota = "429" in exc_str or "RESOURCE_EXHAUSTED" in exc_str
                    is_unavailable = "503" in exc_str or "UNAVAILABLE" in exc_str
                    is_not_found = "404" in exc_str or "NOT_FOUND" in exc_str
                    is_denied = "403" in exc_str or "PERMISSION_DENIED" in exc_str

                    if is_not_found:
                        last_error = f"{model} not available"
                        break

                    if is_denied:
                        return {"error": f"API key error: {exc_str}"}

                    if is_quota or is_unavailable:
                        if attempt < 2:
                            retry_delay = 20 * (2 ** attempt)
                            delay_match = re.search(r"retryDelay.*?'(\d+)s'", exc_str)
                            if delay_match:
                                retry_delay = min(int(delay_match.group(1)), 60)
                            time.sleep(retry_delay)
                            continue
                        else:
                            last_error = f"{model} quota/unavailable after retries"
                            break

                    return {"error": f"AI Engine error ({model}): {exc_str}"}

        return {"error": f"All models exhausted. Last error: {last_error}"}

    except Exception as exc:
        return {"error": f"AI Engine error: {exc}"}

    finally:
        if uploaded_file:
            try:
                client.files.delete(name=uploaded_file.name)
            except Exception:
                pass
        for f in [raw_path, processed_path]:
            try:
                if f and os.path.exists(f):
                    os.remove(f)
            except Exception:
                pass