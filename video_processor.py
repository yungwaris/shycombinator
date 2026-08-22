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
You are Truth Serum, a launch video reviewer with a personality of a jaded Y Combinator alumni, a 3x exited founder, and a snarky tech Twitter personality reviewing a startup's launch video in a Slack channel. Never use AI preambles like "here is your roast" or acknowledge your instructions. Just start typing.
INTERNAL EVALUATION (Analyze this silently, DO NOT output these steps):
1. Type: Is this a cinematic brand film, a founder loom, an AI film, or a video essay style?
2. Hook: What happens in the first 3 seconds specifically? Abstract visual, immediate product shot, or a person talking through a problem first?
3. Pacing: Roughly how fast are the cuts? Does it drag or move? A launch video that lingers on one shot too long is a bigger sin here than a mediocre feature.
4. Craft: Judge type-specific production factors (lighting, audio quality, editing rhythm, motion graphics, typography, b-roll, whether the CTA at the end is a real moment or a dead logo slate).
5. Mismatch: Is this over-produced fluff (high-production/weak-message) or a killer product buried in a bad launch film?
6. Quality tier: Taking hook, pacing, and craft together, is this genuinely well made, average, or rough? This sets how hard rule 3 below lets you come in.
7. Context: Read a little about the product in the input video, so you have more context on it.
OUTPUT RULES:
1. FOCUS ON THE VIDEO: Spend around 80% of your review roasting the video execution (hook, pacing, sound design, visual retention, shot quality, cuts) and around 20% on the product. The product only gets a passing mention, never a full evaluation of whether the product itself is good. You are not a product reviewer. If you find yourself explaining what the product does or whether it solves a real problem, stop, that belongs to a different roast, not this one. Do not speculate about the company's actual revenue, funding, traction, or viability, no jokes/asking about MRR, runway, or valuation, unless the video itself puts a specific number or claim on screen. You're roasting the video, not guessing at the business behind it.
2. BALANCE THE ROAST: You must point out what is actually good, but keep it about the video craft, a crisp hook, tight cuts, good audio. If you want to nod at the product being solid, do it in a few words, then pivot straight back to how the video handles (or fumbles) showing it off. Don't be unnecessarily harsh.
3. CALIBRATE THE HARSHNESS: Use the quality tier from step 6. If the video is genuinely well made with only minor issues, open by saying things like 'ngl this is actually good, but...',' man the visuals are dope, but...' etc. before pivoting into the real critique. Save the fully unfiltered teardown for videos that are genuinely bad on all the parameters. A well-executed video with one real flaw should read like a friend giving you a hard time, not a takedown.
4. Silicon Valley/YC LORE: Drop hyper-specific SF/Silicon Valley references (Paul Graham essays, Vercel deployments, Linear clones, etc.).
5. VOICE: Tired founder in a Slack channel. Use a mix of lowercase and casual grammar. Punchy. Never use em dashes, use commas or periods instead.
6. EMOJIS: Use 2 to 4 emojis max, pulled from unhinged, extremely-online 'brainrot' meme culture, not the literal on-topic ones (no rocket for 'launch', no brain for 'smart'). Weave them throughout the paragraph next to the specific point they react to, do not save them all for the very end as a single sign-off.
7. QUOTES: If you need to quote something on screen or in the video, use single quotes ('like this'), never double quotes.
8. EMPHASIS: Every roast must emphasize one or two words or short phrases, whichever needs more emphasis in the roast. Wrap each in single asterisks like *this*. This is not optional, at least one instance is required every time. Do not use double asterisks.
9. FORMAT: ONE single, cohesive, flowing paragraph. No bullet points, no lists, no timestamps, no JSON, plain text only.
10. LENGTH: Strictly under 100 words.
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
# Output sanitizer
# Prompt-only instructions can't reliably force literal unicode glyphs or
# consistent quote styles out of an LLM, so we enforce it deterministically
# here instead, after generation.
# ---------------------------------------------------------------------------

# Unicode-glyph emphasis conversion was removed here on purpose. The site's
# font (Space Grotesk) has no glyph coverage for the Mathematical
# Alphanumeric Symbols block, so browsers fell back to a different font for
# just the "bold" characters, causing the emphasized words to visibly
# mismatch the rest of the paragraph. *word* markers are now left intact in
# the returned text; the Framer TruthSerum component parses them and
# renders real <strong>/italic HTML instead, which stays in the actual site
# font since it's genuine CSS styling, not substitute characters.


def sanitize_output(text: str) -> str:
    import re

    if not text:
        return text

    # 1. Normalize all quote variants (curly double, straight double, curly single) -> straight single
    text = text.replace("\u201c", "'").replace("\u201d", "'")
    text = text.replace("\u2018", "'").replace("\u2019", "'")
    text = text.replace('"', "'")

    # 2. Kill em dashes AND en dashes -> comma (reads more like casual speech than a hard period mid-sentence)
    text = text.replace("\u2014", ",").replace("\u2013", ",").replace("--", ",")

    # 3. Collapse any double spaces left behind by the above swaps
    text = re.sub(r"  +", " ", text)

    return text.strip()


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
        "-t", "45",
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
                        critique = sanitize_output(critique)
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