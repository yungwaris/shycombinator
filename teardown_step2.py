"""
STEP 2: competitor_launch_teardown, expanded.

Adds three analysis layers on top of the Step 1 pipeline (hook_type,
ui_reveal_second, runtime_seconds, cta_type — unchanged, still Gemini
video-understanding):

  1. PACING DENSITY — cut frequency vs. a real benchmark from a peer-
     reviewed video-ad saliency dataset (ViASNet, 151 TV ads with actual
     eye-tracking gaze data).

  2. NARRATION TYPE — classifies which of five coded categories the
     video uses, per a configurational study on short-video engagement
     (PLOS One, tourism short-video engagement study).

  3. NARRATIVE TENSION — transcript-only, runs ONLY if a transcript or
     voiceover exists. Applies the staging -> plot progression ->
     cognitive tension framework from a large-scale peer-reviewed
     computational linguistics study (Boyd, Blackburn & Pennebaker,
     Science Advances). IMPORTANT CAVEAT baked into the output: that
     study was validated on long-form narrative (novels, TED talks,
     movie scripts), not sub-90-second scripts. Applying it here is a
     reasonable extension of a real method, not a claim that the
     original study proves anything about short-form video specifically.
     The code says this explicitly in its own output so nobody
     downstream mistakes this for more than it is.

WHAT THIS SCRIPT DELIBERATELY DOES NOT CLAIM:
  - No "brain activity" or eye-tracking claims about THIS video. The
    ViASNet numbers are a structural benchmark (how TV ads that were
    eye-tracked tended to be cut), not a live read of anyone's brain
    watching the video being analyzed here.
  - No single "story quality score." Tension/arc pattern is reported
    as a description, not a 1-10 rating, because there's no dataset
    establishing what score is "good" at this video length.

Run this the same way as Step 1 — manually, read the output, verify
a few claims against the real video before trusting any of it.

USAGE:
    export GEMINI_API_KEY="..."   # Windows: $env:GEMINI_API_KEY="..."
    python teardown_step2.py --url "https://youtube.com/watch?v=..."
    python teardown_step2.py --file "/path/to/video.mp4"

REQUIREMENTS:
    pip install google-genai yt-dlp --break-system-packages
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

MODEL_NAME = "gemini-2.5-flash"
DOWNLOAD_DIR = Path("./teardown_downloads")
DOWNLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Cited benchmarks. Keeping these as named constants with sources attached
# directly in comments, on purpose — if a number in this file can't be
# traced to a specific source, it shouldn't be in this file.
# ---------------------------------------------------------------------------

# Source: ViASNet paper (arxiv 2605.29302). Dataset: 151 Dutch TV ads,
# 2023-2024, real Tobii Pro Fusion eye-tracking gaze data, 20 participants
# per ad. Average scene length ~2.0s, average ~15.6 scenes per ad.
PACING_BENCHMARK = {
    "avg_scene_length_seconds": 2.0,
    "avg_scenes_per_30s": 15.6,
    "source": (
        "ViASNet (arXiv 2605.29302) — 151 TV ads, real eye-tracking gaze "
        "data, Netherlands, 2023-2024. NOTE: this is TV commercial data, "
        "not SaaS launch video data. Used here as a directional cut-"
        "frequency reference, not a SaaS-specific benchmark."
    ),
}

# Source: PLOS One tourism short-video engagement study. Five coded
# narration categories shown (as part of a broader configuration, not
# in isolation) to significantly affect engagement.
NARRATION_CATEGORIES = [
    "live_narration",       # on-camera person talking directly
    "voiceover_with_subtitles",
    "voiceover_only",
    "subtitles_only",       # text on screen, no spoken audio
    "no_narration",         # music/visual only, no words at all
]

TEARDOWN_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "hook_type": {
            "type": "string",
            "enum": [
                "abstract_cinematic",
                "immediate_ui_drop",
                "problem_first_narrative",
            ],
        },
        "ui_reveal_second": {"type": "number"},
        "runtime_seconds": {"type": "number"},
        "structure_notes": {"type": "string"},
        "cta_type": {
            "type": "string",
            "enum": ["ui_embedded", "static_logo_slate", "none_detected"],
        },
        "scene_count": {
            "type": "integer",
            "description": "Total number of distinct cuts/scenes in the video.",
        },
        "narration_type": {
            "type": "string",
            "enum": NARRATION_CATEGORIES,
        },
        "has_transcript_worthy_narration": {
            "type": "boolean",
            "description": (
                "True if there is spoken dialogue/voiceover with enough "
                "content to meaningfully analyze as text (roughly more "
                "than a couple of short sentences). False for music-only, "
                "single-word-on-screen, or near-silent videos."
            ),
        },
        "full_transcript": {
            "type": "string",
            "description": (
                "The full spoken/voiceover transcript if "
                "has_transcript_worthy_narration is true. Empty string "
                "otherwise. Do not paraphrase — transcribe as spoken."
            ),
        },
    },
    "required": [
        "hook_type",
        "ui_reveal_second",
        "runtime_seconds",
        "structure_notes",
        "cta_type",
        "scene_count",
        "narration_type",
        "has_transcript_worthy_narration",
        "full_transcript",
    ],
}

TEARDOWN_SYSTEM_PROMPT = """You are analyzing a SaaS/startup launch or brand
video for a video production agency's competitor-teardown tool. Your job is
structural analysis, not opinion — classify what the video actually does.

Watch the full video before answering. Pay attention to:
- What appears on screen in the first 3 seconds specifically
- The exact moment product UI first becomes visible, if it does
- Every distinct cut/scene change, for an accurate scene_count
- Which of the five narration_type categories genuinely applies
- Whether there's enough spoken narration to transcribe meaningfully

If there is voiceover or dialogue, transcribe it fully and accurately in
full_transcript. Do not paraphrase or summarize the transcript — that
field must be the actual words spoken, since it will be analyzed
separately as text. If there's no meaningful spoken content, leave
full_transcript as an empty string and set has_transcript_worthy_narration
to false.

Return ONLY the structured fields requested."""


# Second pass, text-only, only runs if a real transcript came back.
TENSION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "staging_present": {
            "type": "boolean",
            "description": (
                "Does the opening establish context/setting before "
                "progressing the narrative? (Boyd et al.'s 'staging' phase.)"
            ),
        },
        "plot_progression_notes": {
            "type": "string",
            "description": (
                "1-2 sentences on how the narrative moves forward "
                "through the script, in your own words."
            ),
        },
        "tension_trajectory": {
            "type": "string",
            "enum": [
                "rising_throughout",
                "peaks_middle_to_late",
                "flat_no_clear_arc",
                "front_loaded_then_flat",
            ],
            "description": (
                "peaks_middle_to_late matches the pattern Boyd et al. "
                "found as most common across ~40,000 long-form "
                "narratives. Given this script is far shorter than what "
                "that study analyzed, treat any of these labels as a "
                "rough directional read, not a precise measurement."
            ),
        },
        "caveat_acknowledgment": {
            "type": "string",
            "description": (
                "Always populate with: 'This framework was validated on "
                "long-form narrative (novels, TED talks, movie scripts) "
                "averaging far more text than this script contains. "
                "Applied here as a reasonable extension, not a proven "
                "measurement at this length.'"
            ),
        },
    },
    "required": [
        "staging_present",
        "plot_progression_notes",
        "tension_trajectory",
        "caveat_acknowledgment",
    ],
}

TENSION_SYSTEM_PROMPT = """You are applying a specific, established
narrative-analysis framework to a short video transcript.

The framework (Boyd, Blackburn & Pennebaker, published in Science
Advances) identifies three structural phases in narrative text: staging
(establishing context), plot progression (moving the story forward,
often carried by pronouns/connectives), and cognitive tension (the
story's emotional/stakes peak, typically in the middle-to-late portion
of long-form narratives in the original study).

Apply this lens to the transcript below. Be honest if the script is too
short or too flat for a clear arc to be visible — "flat_no_clear_arc" is
a legitimate, expected answer for many short ad scripts, not a failure
of your analysis.

Do not invent emotional beats that aren't actually in the text."""


# ---------------------------------------------------------------------------
# Download (unchanged from Step 1, with the ejs:github fix baked in)
# ---------------------------------------------------------------------------

def download_video(url: str) -> Path:
    print(f"[1/5] Downloading via yt-dlp: {url}")
    output_template = str(DOWNLOAD_DIR / "%(id)s.%(ext)s")
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--remote-components", "ejs:github",
        "-f", "best[ext=mp4]/best",
        "--no-playlist",
        "-o", output_template,
        url,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print("yt-dlp failed. stderr:", file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        raise RuntimeError(
            "Download failed. Check stderr above — as of mid-2026 the "
            "most common cause is a missing JS challenge solver "
            "(look for 'JavaScript runtime' or 'n challenge solving "
            "failed'). This script already passes --remote-components "
            "ejs:github; if you still see that error, run "
            "`python -m yt_dlp --version` and confirm Deno is installed."
        )
    downloaded = sorted(DOWNLOAD_DIR.glob("*"), key=lambda p: p.stat().st_mtime)
    if not downloaded:
        raise RuntimeError("yt-dlp reported success but no file was found.")
    video_path = downloaded[-1]
    print(f"       Saved: {video_path} ({video_path.stat().st_size / 1e6:.1f} MB)")
    return video_path


# ---------------------------------------------------------------------------
# Gemini calls
# ---------------------------------------------------------------------------

def get_client():
    try:
        from google import genai
    except ImportError:
        print(
            "Missing dependency. Run:\n"
            "  pip install google-genai --break-system-packages",
            file=sys.stderr,
        )
        sys.exit(1)
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set in this environment.", file=sys.stderr)
        sys.exit(1)
    return genai.Client(api_key=api_key)


def analyze_video(client, video_path: Path) -> dict:
    from google.genai import types

    print(f"[2/5] Uploading to Gemini File API: {video_path.name}")
    uploaded_file = client.files.upload(file=str(video_path))

    print("[3/5] Waiting for Gemini to finish processing...")
    while uploaded_file.state.name == "PROCESSING":
        time.sleep(3)
        uploaded_file = client.files.get(name=uploaded_file.name)
    if uploaded_file.state.name == "FAILED":
        raise RuntimeError(f"Gemini file processing failed: {uploaded_file.state}")

    print("[4/5] Requesting structural teardown + transcript...")
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[uploaded_file, TEARDOWN_SYSTEM_PROMPT],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TEARDOWN_RESPONSE_SCHEMA,
            temperature=0.1,
        ),
    )
    return json.loads(response.text)


def analyze_tension(client, transcript: str) -> dict:
    from google.genai import types

    print("[5/5] Transcript present — running narrative tension pass...")
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=[TENSION_SYSTEM_PROMPT, f"\n\nTRANSCRIPT:\n{transcript}"],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=TENSION_RESPONSE_SCHEMA,
            temperature=0.2,
        ),
    )
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Pacing comparison — plain arithmetic against the cited benchmark.
# Deliberately NOT an LLM call: this is a deterministic comparison once
# scene_count and runtime_seconds exist, so it shouldn't cost an extra
# API call or introduce model variance.
# ---------------------------------------------------------------------------

def compare_pacing(scene_count: int, runtime_seconds: float) -> dict:
    if runtime_seconds <= 0:
        return {"note": "runtime_seconds was 0 or missing, cannot compare pacing."}

    this_video_avg_scene_length = runtime_seconds / max(scene_count, 1)
    scenes_per_30s_equivalent = scene_count / (runtime_seconds / 30)

    return {
        "this_video_avg_scene_length_seconds": round(this_video_avg_scene_length, 2),
        "benchmark_avg_scene_length_seconds": PACING_BENCHMARK["avg_scene_length_seconds"],
        "this_video_scenes_per_30s_equivalent": round(scenes_per_30s_equivalent, 1),
        "benchmark_scenes_per_30s": PACING_BENCHMARK["avg_scenes_per_30s"],
        "faster_or_slower_cutting_than_benchmark": (
            "faster" if this_video_avg_scene_length < PACING_BENCHMARK["avg_scene_length_seconds"]
            else "slower"
        ),
        "source": PACING_BENCHMARK["source"],
    }


# ---------------------------------------------------------------------------
# Output + verification checklist
# ---------------------------------------------------------------------------

def print_results(teardown: dict, pacing: dict, tension: dict | None, video_path: Path):
    print("\n" + "=" * 70)
    print("STRUCTURAL TEARDOWN")
    print("=" * 70)
    display = {k: v for k, v in teardown.items() if k != "full_transcript"}
    print(json.dumps(display, indent=2))

    print("\n" + "=" * 70)
    print("PACING vs. CITED BENCHMARK")
    print("=" * 70)
    print(json.dumps(pacing, indent=2))

    if tension is not None:
        print("\n" + "=" * 70)
        print("NARRATIVE TENSION (transcript-based, see caveat inside)")
        print("=" * 70)
        print(json.dumps(tension, indent=2))
        print(f"\nTranscript analyzed:\n{teardown.get('full_transcript', '')}")
    else:
        print("\n(No transcript-worthy narration detected — tension analysis skipped.)")

    print("\n" + "=" * 70)
    print("MANUAL VERIFICATION — do this before trusting any of the above")
    print("=" * 70)
    print(f"""
Watch {video_path} yourself and check:

  [ ] ui_reveal_second ({teardown.get('ui_reveal_second')}s) — scrub there,
      does UI actually appear?
  [ ] hook_type ("{teardown.get('hook_type')}") — matches the first 3s?
  [ ] scene_count ({teardown.get('scene_count')}) — roughly count the cuts
      yourself. LLM scene-counting on video is the least-tested field in
      this pipeline; if it's noticeably off, the pacing comparison above
      is unreliable until this is fixed.
  [ ] narration_type ("{teardown.get('narration_type')}") — does this
      category actually match what you hear/see?
  [ ] If a transcript was extracted, spot check 2-3 lines against the
      actual audio — transcription errors would corrupt the tension
      analysis downstream.
  [ ] If tension analysis ran, read plot_progression_notes back after
      watching — generic template language here is a real failure mode,
      same as structure_notes in Step 1.
""")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="Video URL")
    source.add_argument("--file", help="Local video file path")
    args = parser.parse_args()

    video_path = download_video(args.url) if args.url else Path(args.file)
    if args.file and not video_path.exists():
        print(f"File not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    client = get_client()
    teardown = analyze_video(client, video_path)

    pacing = compare_pacing(teardown.get("scene_count", 0), teardown.get("runtime_seconds", 0))

    tension = None
    if teardown.get("has_transcript_worthy_narration") and teardown.get("full_transcript", "").strip():
        tension = analyze_tension(client, teardown["full_transcript"])

    print_results(teardown, pacing, tension, video_path)


if __name__ == "__main__":
    main()