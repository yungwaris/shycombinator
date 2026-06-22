"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Info, Bot, Video, ArrowRight } from "lucide-react";

const SUPPORTED_PLATFORMS = ["x.com", "twitter.com", "linkedin.com"];

const loadingPhrases = [
  "Drafting the rejection email...",
  "Looking for actual users...",
  "Checking if this is just an AI wrapper...",
  "Judging your MRR...",
  "Calculating your burn rate...",
  "Reading Paul Graham essays...",
  "Preparing to ask about retention..."
];

// Approximate progress stages with durations (ms)
const PROGRESS_STAGES = [
  { label: "Downloading video...",     target: 22,  duration: 8000  },
  { label: "Compressing...",           target: 38,  duration: 5000  },
  { label: "Uploading to Gemini...",   target: 55,  duration: 8000  },
  { label: "Processing video...",      target: 72,  duration: 10000 },
  { label: "Generating roast...",      target: 90,  duration: 12000 },
  { label: "Almost there...",          target: 97,  duration: 8000  },
];

function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url) return { valid: false, error: "Video URL is required." };
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.replace("www.", "");
    if (!SUPPORTED_PLATFORMS.some((p) => host.includes(p))) {
      return {
        valid: false,
        error: "Only X (twitter.com) and LinkedIn video links are supported.",
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Enter a valid URL." };
  }
}

export default function DirectorsCut() {
  const [url, setUrl]               = useState("");
  const [email, setEmail]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [urlError, setUrlError]     = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex]   = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [timestamp, setTimestamp]   = useState("");
  const [progress, setProgress]     = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [urlTouched, setUrlTouched]     = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const stageIndex    = useRef(0);
  const stageStart    = useRef(0);

  // Phrase cycling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setPhraseVisible(false);
        setTimeout(() => {
          setPhraseIndex((p) => (p + 1) % loadingPhrases.length);
          setPhraseVisible(true);
        }, 220);
      }, 2500);
    } else {
      setPhraseIndex(0);
      setPhraseVisible(true);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Progress bar animation
  function startProgress() {
    stageIndex.current = 0;
    stageStart.current = Date.now();
    setProgress(0);
    setProgressLabel(PROGRESS_STAGES[0].label);

    function tick() {
      const si = stageIndex.current;
      if (si >= PROGRESS_STAGES.length) return;
      const stage = PROGRESS_STAGES[si];
      const prev  = si > 0 ? PROGRESS_STAGES[si - 1].target : 0;
      const elapsed = Date.now() - stageStart.current;
      const frac  = Math.min(elapsed / stage.duration, 1);
      const cur   = prev + (stage.target - prev) * frac;
      setProgress(Math.round(cur));

      if (frac >= 1) {
        stageIndex.current = si + 1;
        stageStart.current = Date.now();
        if (stageIndex.current < PROGRESS_STAGES.length) {
          setProgressLabel(PROGRESS_STAGES[stageIndex.current].label);
        }
      }
      progressTimer.current = setTimeout(tick, 80);
    }
    tick();
  }

  function stopProgress(success: boolean) {
    if (progressTimer.current) clearTimeout(progressTimer.current);
    if (success) {
      setProgress(100);
      setProgressLabel("Done!");
    } else {
      setProgress(0);
      setProgressLabel("");
    }
  }

  // Inline validation on blur
  function handleEmailBlur() {
    setEmailTouched(true);
    if (!email) setEmailError("Email is required.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setEmailError("Enter a valid email.");
    else setEmailError(null);
  }

  function handleUrlBlur() {
    setUrlTouched(true);
    if (!url) { setUrlError("Video URL is required."); return; }
    const v = validateUrl(url);
    setUrlError(v.error || null);
  }

  const handleAnalyze = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate both fields before submitting
    setEmailTouched(true);
    setUrlTouched(true);

    let hasError = false;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(!email ? "Email is required." : "Enter a valid email.");
      hasError = true;
    }
    const urlCheck = validateUrl(url);
    if (!urlCheck.valid) {
      setUrlError(urlCheck.error || "Invalid URL.");
      hasError = true;
    }
    if (hasError) return;

    setLoading(true);
    setResults(null);
    setErrorMsg(null);
    startProgress();

    try {
      const res = await fetch("/api/roast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email }),
      });

      if (!res.ok) {
        const raw = await res.text();
        try {
          const err = JSON.parse(raw);
          if (err.error) { stopProgress(false); setErrorMsg(err.error); setLoading(false); return; }
        } catch {}
        stopProgress(false);
        setErrorMsg(`Server error ${res.status}.`);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.error) {
        stopProgress(false);
        setErrorMsg(data.error);
      } else if (data.critique) {
        stopProgress(true);
        setResults(data.critique);
        const now = new Date();
        setTimestamp(
          now.getUTCHours().toString().padStart(2, "0") + ":" +
          now.getUTCMinutes().toString().padStart(2, "0") + " UTC"
        );
      }
    } catch (err: any) {
      stopProgress(false);
      setErrorMsg(`Connection broken: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white min-h-screen w-full flex flex-col text-[#111] font-sans px-4 sm:px-8 py-8 sm:py-12 selection:bg-[#ebebff] selection:text-[#0000ff]">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Space+Mono:wght@400;700&display=swap');
        .dc-font-mono { font-family: 'Space Mono', monospace; }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.65)} }
        .dc-badge-dot { animation: pulse-dot 1.8s ease-in-out infinite; }
        @keyframes bar-bounce { 0%,100%{opacity:.2;transform:scaleY(.65)}50%{opacity:1;transform:scaleY(1)} }
        .dc-bar { animation: bar-bounce 1.1s ease-in-out infinite; transform-origin: bottom; }
        .dc-bar:nth-child(1){height:16px;animation-delay:0s}
        .dc-bar:nth-child(2){height:24px;animation-delay:.12s}
        .dc-bar:nth-child(3){height:12px;animation-delay:.24s}
        .dc-bar:nth-child(4){height:28px;animation-delay:.36s}
        .dc-bar:nth-child(5){height:16px;animation-delay:.48s}
        @keyframes slide-up { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .dc-animate-result { animation: slide-up 0.5s ease both; }
        @keyframes progress-shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .dc-progress-bar {
          background: linear-gradient(90deg, #0000ff 0%, #4444ff 40%, #0000ff 60%, #0000cc 100%);
          background-size: 200% auto;
          animation: progress-shine 2s linear infinite;
          transition: width 0.3s ease;
        }
      `}} />

      <div className="max-w-[720px] w-full mx-auto flex flex-col flex-1">
        <div className="flex-1 flex flex-col justify-center">
          <h2 className="sr-only">The Director&apos;s Cut — AI startup launch video roaster</h2>

          {/* Header */}
          <div className="mb-8 sm:mb-10 text-left mt-8 sm:mt-0">
            <div className="inline-flex items-center gap-[6px] bg-[#ebebff] text-[#0000ff] text-[10px] sm:text-[11px] font-medium tracking-[0.08em] uppercase px-3 py-1 rounded-full border border-[#b3b3ff] mb-5">
              <div className="w-[6px] h-[6px] rounded-full bg-[#0000ff] dc-badge-dot" />
              AI partner online
            </div>
            <img src="/ShyCombintorLogo.png" alt="Shy Combinator" className="h-8 sm:h-10 object-contain mb-5 block" />
            <h1 className="text-[28px] sm:text-[36px] font-light text-[#0a0a0a] tracking-[-0.03em] leading-[1.15] mb-3">
              The <strong className="font-semibold text-[#0000ff] italic">Director&apos;s</strong> Cut.
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#888] font-normal leading-[1.6] max-w-[480px]">
              Drop an <span className="text-[#111] font-medium">X or LinkedIn</span> launch video link. Our AI partner will tell you, with love, why your startup is going to zero.
            </p>
          </div>

          <div className="h-[0.5px] bg-[#e8e8e8] my-6 sm:my-8" />

          {/* Form */}
          <form onSubmit={handleAnalyze} noValidate className="mb-4 space-y-4">

            {/* Email */}
            <div>
              <div className="text-[10px] sm:text-[11px] font-medium tracking-[0.08em] uppercase text-[#aaa] mb-2 dc-font-mono flex items-center gap-1">
                // your email <span className="text-red-500 text-[13px] leading-none">*</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailTouched) setEmailError(null); }}
                onBlur={handleEmailBlur}
                placeholder="founder@yourstartup.com"
                autoComplete="email"
                spellCheck="false"
                className={`w-full border rounded-lg outline-none px-4 py-3 text-[13px] sm:text-[14px] text-[#111] bg-[#fafafa] placeholder-[#bbb] transition-all duration-200
                  ${emailError
                    ? "border-red-400 ring-[3px] ring-red-100 bg-red-50/30"
                    : "border-[#e0e0e0] focus:border-[#0000ff] focus:ring-[3px] focus:ring-[#0000ff]/10 focus:bg-white"
                  }`}
              />
              {emailError && (
                <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1 dc-font-mono">
                  <AlertCircle className="w-3 h-3 shrink-0" />{emailError}
                </p>
              )}
            </div>

            {/* URL + button */}
            <div>
              <div className="text-[10px] sm:text-[11px] font-medium tracking-[0.08em] uppercase text-[#aaa] mb-2 dc-font-mono flex items-center gap-1">
                // x or linkedin video url <span className="text-red-500 text-[13px] leading-none">*</span>
              </div>
              <div className={`flex flex-col sm:flex-row gap-3 sm:gap-0 sm:rounded-lg sm:overflow-hidden sm:border transition-all duration-200
                ${urlError
                  ? "sm:border-red-400 sm:ring-[3px] sm:ring-red-100"
                  : "sm:border-[#e0e0e0] focus-within:sm:border-[#0000ff] focus-within:sm:ring-[3px] focus-within:sm:ring-[#0000ff]/10"
                }`}>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (urlTouched) setUrlError(null); }}
                  onBlur={handleUrlBlur}
                  placeholder="x.com/... or linkedin.com/posts/..."
                  autoComplete="off"
                  spellCheck="false"
                  className={`flex-1 sm:border-none rounded-lg sm:rounded-none outline-none px-4 py-3 sm:py-[14px] text-[13px] sm:text-[14px] text-[#111] bg-[#fafafa] min-w-0 placeholder-[#bbb] transition-all duration-200
                    ${urlError
                      ? "border border-red-400 ring-[3px] ring-red-100 bg-red-50/30 sm:ring-0 sm:border-none"
                      : "border border-[#e0e0e0] focus:border-[#0000ff] focus:ring-[3px] focus:ring-[#0000ff]/10 sm:focus:ring-0 sm:focus:border-transparent"
                    }`}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="border-none bg-[#0000ff] rounded-lg sm:rounded-none text-white text-[13px] font-medium px-6 py-3 sm:py-[14px] cursor-pointer transition-all hover:bg-[#0000cc] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap tracking-[0.02em]"
                >
                  {loading ? "Ingesting..." : "Analyze →"}
                </button>
              </div>
              {urlError && (
                <p className="text-[11px] text-red-500 mt-1.5 flex items-center gap-1 dc-font-mono">
                  <AlertCircle className="w-3 h-3 shrink-0" />{urlError}
                </p>
              )}
              <div className="text-[11px] sm:text-[12px] text-[#bbb] mt-2 flex items-center gap-[5px] dc-font-mono">
                <Info className="w-[13px] h-[13px]" />
                only x.com and linkedin.com video links are supported
              </div>
            </div>
          </form>

          {/* Global error */}
          {errorMsg && (
            <div className="flex items-start sm:items-center gap-[10px] bg-[#fff5f5] border border-[#ffbbbb] rounded-lg p-3 sm:p-4 text-[12px] sm:text-[13px] text-[#c0392b] mt-3">
              <AlertCircle className="w-[16px] sm:w-[18px] h-[16px] sm:h-[18px] shrink-0 mt-[2px] sm:mt-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Progress loader */}
          {loading && (
            <div className="mt-6 space-y-4">
              {/* Bar */}
              <div className="w-full bg-[#f0f0ff] rounded-full h-[6px] overflow-hidden">
                <div
                  className="dc-progress-bar h-full rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Label + phrase */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-[5px] items-end h-5">
                    <div className="w-[2px] rounded-[2px] bg-[#0000ff] dc-bar" />
                    <div className="w-[2px] rounded-[2px] bg-[#0000ff] dc-bar" />
                    <div className="w-[2px] rounded-[2px] bg-[#0000ff] dc-bar" />
                    <div className="w-[2px] rounded-[2px] bg-[#0000ff] dc-bar" />
                    <div className="w-[2px] rounded-[2px] bg-[#0000ff] dc-bar" />
                  </div>
                  <span
                    className="text-[11px] sm:text-[12px] dc-font-mono text-[#555] transition-opacity duration-220"
                    style={{ opacity: phraseVisible ? 1 : 0 }}
                  >
                    {progressLabel || loadingPhrases[phraseIndex]}
                  </span>
                </div>
                <span className="text-[11px] dc-font-mono text-[#aaa]">{progress}%</span>
              </div>
            </div>
          )}

          {/* Results */}
          {results && !loading && (
            <div className="dc-animate-result mt-6">
              <div className="border border-[#e0e0e0] rounded-xl overflow-hidden mb-6">
                <div className="bg-[#f5f5ff] border-b border-[#e0e0e0] px-4 sm:px-5 py-3 flex items-center justify-between">
                  <span className="text-[10px] sm:text-[11px] dc-font-mono font-bold tracking-[0.08em] text-[#0000ff] uppercase flex items-center gap-[5px]">
                    <Bot className="w-[12px] sm:w-[13px] h-[12px] sm:h-[13px]" />
                    message from partner
                  </span>
                  <span className="text-[10px] sm:text-[11px] dc-font-mono text-[#ccc]">{timestamp || "—"}</span>
                </div>
                <div className="p-4 sm:p-6 bg-white">
                  <p className="text-[14px] sm:text-[16px] font-normal text-[#1a1a1a] leading-[1.6] sm:leading-[1.75] whitespace-pre-wrap">
                    {results}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 p-5 sm:p-6 border border-[#b3b3ff] rounded-xl bg-[#f5f5ff]">
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#0000ff] rounded-lg flex items-center justify-center shrink-0 text-white">
                  <Video className="w-[16px] sm:w-[18px] h-[16px] sm:h-[18px]" />
                </div>
                <div className="text-left">
                  <h3 className="text-[13px] sm:text-[14px] font-semibold text-[#0a0a0a] mb-1 tracking-[-0.01em]">
                    Your product deserves a better edit.
                  </h3>
                  <p className="text-[12px] sm:text-[13px] text-[#888] leading-[1.55] mb-3">
                    Don&apos;t let a template-grade production kill your conversion. Upgrade to commercial-grade visual standards.
                  </p>
                  <button className="inline-flex items-center justify-center sm:justify-start w-full sm:w-auto gap-[6px] bg-[#0000ff] text-white border-none rounded-md text-[13px] font-medium px-[18px] py-[9px] cursor-pointer transition-colors hover:bg-[#0000cc]">
                    Book a strategy call <ArrowRight className="w-[13px] h-[13px]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto pt-12 pb-4 flex flex-col sm:flex-row items-center justify-between text-[10px] sm:text-[11px] dc-font-mono text-[#ccc] gap-2">
          <span className="text-[#0000ff]">by Dabloo Studios</span>
          <span className="text-[#e0e0e0]">— video production, elevated</span>
        </div>
      </div>
    </div>
  );
}