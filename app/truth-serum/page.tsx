"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

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
        error: "Only X (twitter.com) and LinkedIn links supported.",
      };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Enter a valid URL." };
  }
}

export default function TruthSerum() {
  const [url, setUrl]               = useState("");
  const [email, setEmail]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [results, setResults]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [urlError, setUrlError]     = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex]   = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [progress, setProgress]     = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [urlTouched, setUrlTouched]     = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const progressTimer = useRef<NodeJS.Timeout | null>(null);
  const stageIndex    = useRef(0);
  const stageStart    = useRef(0);

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
      }
    } catch (err: any) {
      stopProgress(false);
      setErrorMsg(`Connection broken: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white font-sans overflow-x-hidden flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700&family=Space+Mono:wght@400;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: white; min-height: 100vh; }
        
        .dc-font-mono { font-family: 'Space Mono', monospace; }

        /* ── NAV ── */
        .nav {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 32px 40px 0; 
          width: 100%;
          margin: 0 auto;
        }
        .nav-logo, .truth-logo {
          height: 60px;
          width: auto;
        }

        /* ── MAIN CONTENT AREA ── */
        .content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 60px 5% 0;
          position: relative;
          z-index: 5;
        }

        /* ── TYPOGRAPHY ── */
        .headline {
          text-align: center;
          font-size: 24px;
          line-height: 1.4;
          color: #000;
          font-weight: 300;
          margin-bottom: 40px;
        }
        .headline strong {
          font-weight: 700;
        }

        /* ── FORM ── */
        .form-container {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          max-width: 450px;
          align-items: center;
        }
        .input-row {
          position: relative;
          width: 100%;
          display: flex;
          justify-content: center;
        }
        .truth-input {
          width: 100%;
          background-color: #0000ff;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          outline: none;
          text-align: left;
        }
        .truth-input::placeholder {
          color: rgba(255, 255, 255, 0.7);
        }
        .truth-input:focus {
          box-shadow: 0 0 0 3px rgba(0, 0, 255, 0.3);
        }
        
        /* ── FLOATING LABELS & ARROWS ── */
        .floating-label {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: #000;
        }
        .label-red-star { color: red; }
        
        .label-right {
          left: calc(100% + 15px);
          top: 50%;
          transform: translateY(-50%);
          white-space: nowrap;
        }
        .label-left {
          right: calc(100% + 15px);
          top: 50%;
          transform: translateY(-50%);
          white-space: nowrap;
          flex-direction: row-reverse; /* Put text on left of arrow */
        }

        /* ── BUTTON ── */
        .submit-btn {
          background: none;
          border: none;
          cursor: pointer;
          margin-top: 10px;
          transition: transform 0.1s;
        }
        .submit-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .submit-btn img {
          height: 40px;
          width: auto;
        }

        /* ── GRAPHICS ── */
        .syringe-img {
          position: absolute;
          right: -150px;
          top: 80px;
          width: 100px;
          height: auto;
          pointer-events: none;
        }

        /* ── POST-CLICK RESULTS ── */
        .result-container {
          position: relative;
          background-color: #0000ff;
          border-radius: 16px;
          padding: 40px;
          color: white;
          width: 100%;
          max-width: 650px;
          margin-top: 40px;
          text-align: left;
          line-height: 1.6;
          font-size: 16px;
        }
        .dosage-img {
          position: absolute;
          top: -25px;
          left: 50%;
          transform: translateX(-50%);
          height: 50px;
          width: auto;
        }
        .quote-section {
          max-width: 500px;
          text-align: center;
          margin-top: 40px;
        }
        .quote-text {
          font-size: 18px;
          color: #555;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .brawl-graham-img {
          height: 80px;
          width: auto;
          margin: 0 auto;
        }

        /* ── BOTTOM STICKY AREA ── */
        .socials {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-bottom: 20px;
          position: relative;
          z-index: 10;
        }
        .social-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #888;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          text-decoration: none;
          transition: background 0.15s;
        }
        .social-icon:hover { background: #0000ff; }
        .social-icon svg { width: 22px; height: 22px; fill: white; }

        .bottom-area {
          flex-grow: 1; 
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          position: relative;
          margin-top: 60px; 
          min-height: 250px;
        }
        .graphics-container {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%; 
          height: 100%;
          pointer-events: none;
        }
        .cursor-img {
          position: absolute;
          top: -30px; 
          left: 50%;
          transform: translateX(-50%);
          width: 220px; 
          height: auto;
          z-index: 3;
          display: block;
        }
        .fire-img {
          position: absolute;
          bottom: -10px;
          left: 10%;
          width: 140px;
          height: auto;
          z-index: 2;
          display: block;
        }

        /* ── FOOTER ── */
        .footer {
          position: relative;
          z-index: 10; 
          text-align: center;
          font-size: 14px;
          color: #999;
          padding: 20px 20px 30px;
        }
        .footer-logo {
          width: 80px;
          height: auto;
          display: block;
          margin: 0 auto 10px;
        }

        /* ── LOADING BAR ── */
        .dc-progress-bar {
          background: linear-gradient(90deg, #0000ff 0%, #4444ff 40%, #0000ff 60%, #0000cc 100%);
          background-size: 200% auto;
          animation: progress-shine 2s linear infinite;
          transition: width 0.3s ease;
        }
        @keyframes progress-shine {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .floating-label {
            position: relative;
            left: 0 !important;
            right: 0 !important;
            top: 0 !important;
            transform: none !important;
            flex-direction: row !important;
            margin-bottom: 8px;
            justify-content: flex-start;
          }
          .label-right svg, .label-left svg { display: none; } /* Hide arrows on mobile */
          .input-row { flex-direction: column; align-items: flex-start; }
          .syringe-img { display: none; } /* Hide syringe to avoid breaking mobile width */
          .headline { font-size: 20px; }
          .nav { padding: 24px 20px 0; }
          .nav-logo, .truth-logo { height: 40px; }
        }

        @media (min-width: 768px) {
          .fire-img { width: 180px; left: 15%; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav className="nav">
        <a href="/">
          <img src="/ShyCombintorLogo.png" alt="Shy Combinator" className="nav-logo" />
        </a>
        <img src="/truthserum_button.png" alt="Truth Serum" className="truth-logo" />
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div className="content-wrapper">
        
        {/* VIEW 1: FORM (Only show if not loading and no results) */}
        {!loading && !results && (
          <>
            <h1 className="headline">
              Drop your <strong>X or LinkedIn</strong> product launch film link.<br/>
              Get one free dose of <strong>Truth Serum.</strong><br/>
              Brutal feedback with zero sugarcoating.
            </h1>

            <form onSubmit={handleAnalyze} noValidate className="form-container">
              
              {/* Syringe Graphic (Desktop only) */}
              <img src="/syringe.png" alt="Syringe" className="syringe-img" />

              {/* Email Input */}
              <div className="input-row w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailTouched) setEmailError(null); }}
                  onBlur={handleEmailBlur}
                  placeholder="johndoe@siliconvalley.com"
                  className="truth-input"
                />
                <div className="floating-label label-right">
                  <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 15 Q 20 15 35 5" stroke="black" strokeWidth="1" fill="none" />
                    <path d="M30 2 L 36 4 L 33 10" stroke="black" strokeWidth="1" fill="none" />
                  </svg>
                  <span>put your email<span className="label-red-star">*</span></span>
                </div>
              </div>
              {emailError && (
                <p className="text-[12px] text-red-500 w-full text-left mt-[-10px] flex items-center gap-1 dc-font-mono">
                  <AlertCircle className="w-3 h-3" /> {emailError}
                </p>
              )}

              {/* URL Input */}
              <div className="input-row w-full">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); if (urlTouched) setUrlError(null); }}
                  onBlur={handleUrlBlur}
                  placeholder="x.com/.... or linkedin.com/....."
                  className="truth-input"
                />
                <div className="floating-label label-left">
                  <svg width="40" height="20" viewBox="0 0 40 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M40 10 Q 20 10 5 15" stroke="black" strokeWidth="1" fill="none" />
                    <path d="M10 20 L 4 16 L 10 10" stroke="black" strokeWidth="1" fill="none" />
                  </svg>
                  <span className="text-right">put your X or<br/>LinkedIn video link<span className="label-red-star">*</span></span>
                </div>
              </div>
              {urlError && (
                <p className="text-[12px] text-red-500 w-full text-left mt-[-10px] flex items-center gap-1 dc-font-mono">
                  <AlertCircle className="w-3 h-3" /> {urlError}
                </p>
              )}

              {/* Global Error */}
              {errorMsg && (
                <div className="text-[13px] text-red-500 dc-font-mono mt-2 bg-red-50 p-2 border border-red-200 rounded">
                  {errorMsg}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="submit-btn">
                <img src="/analyze-button.png" alt="Analyze" />
              </button>
            </form>
          </>
        )}

        {/* VIEW 2: LOADING */}
        {loading && (
          <div className="w-full max-w-[450px] mt-20 space-y-4">
            <div className="w-full bg-[#f0f0ff] rounded-full h-[6px] overflow-hidden">
              <div
                className="dc-progress-bar h-full rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span
                className="text-[12px] dc-font-mono text-[#555] transition-opacity duration-220"
                style={{ opacity: phraseVisible ? 1 : 0 }}
              >
                {progressLabel || loadingPhrases[phraseIndex]}
              </span>
              <span className="text-[12px] dc-font-mono text-[#aaa]">{progress}%</span>
            </div>
          </div>
        )}

        {/* VIEW 3: RESULTS */}
        {results && !loading && (
          <>
            <div className="result-container">
              <img src="/dosage.png" alt="Dosage of Truth Serum" className="dosage-img" />
              <p className="whitespace-pre-wrap">{results}</p>
            </div>

            <div className="quote-section">
              <p className="quote-text">
                "If we've learned one thing from funding so many startups, it's that they succeed or fail based on the quality of their launch film."
              </p>
              <img src="/brawl_graham.png" alt="Brawl Graham" className="brawl-graham-img" />
            </div>
          </>
        )}

      </div>

      {/* ── BOTTOM ANCHORED AREA ── */}
      <div className="bottom-area">
        <div className="socials">
          <a href="https://x.com/shycombinator" target="_blank" rel="noopener noreferrer" className="social-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/shycombinator/" target="_blank" rel="noopener noreferrer" className="social-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://instagram.com/shycombinator.co" target="_blank" rel="noopener noreferrer" className="social-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
          </a>
        </div>

        <div className="graphics-container">
          <img src="/cursor.png" alt="" className="cursor-img" />
          <img src="/fire.png" alt="" className="fire-img" />
        </div>
        
        <div className="footer">
          <img src="/dabloo_logo.png" alt="Dabloo Studios" className="footer-logo" />
          © 2026 Dabloo Studios. All rights reserved.
        </div>
      </div>

    </main>
  );
}