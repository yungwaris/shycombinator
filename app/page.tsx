"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

export default function Home() {
  const [displayNum, setDisplayNum] = useState("?");
  const [settled, setSettled] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Cycle through random numbers rapidly, then settle
    let count = 0;
    const total = 18; // spins before settling
    intervalRef.current = setInterval(() => {
      setDisplayNum(String(Math.floor(Math.random() * 10) + 1));
      count++;
      if (count >= total) {
        clearInterval(intervalRef.current!);
        setDisplayNum("7");
        setSettled(true);
        // restart cycle after 3s pause
        timeoutRef.current = setTimeout(() => {
          setSettled(false);
          count = 0;
          intervalRef.current = setInterval(() => {
            setDisplayNum(String(Math.floor(Math.random() * 10) + 1));
            count++;
            if (count >= total) {
              clearInterval(intervalRef.current!);
              setDisplayNum(String(Math.floor(Math.random() * 10) + 1));
              setSettled(true);
            }
          }, 80);
        }, 3000);
      }
    }, 80);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <main className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,700;1,900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: white; }

        .landing-root { max-width: 430px; margin: 0 auto; min-height: 100vh; position: relative; padding-bottom: 80px; }

        /* NAV */
        .nav { display: flex; align-items: center; justify-content: space-between; padding: 24px 20px 0; }
        .nav-logo { width: 90px; }
        .roast-btn {
          font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
          text-transform: uppercase; border: 2px solid #111; border-radius: 6px;
          padding: 8px 18px; background: white; color: #111; cursor: pointer;
          text-decoration: none; transition: background 0.15s, color 0.15s;
        }
        .roast-btn:hover { background: #0000ff; color: white; border-color: #0000ff; }

        /* HERO */
        .hero { padding: 48px 20px 0; position: relative; }
        .hero-text {
          font-size: 48px; font-weight: 900; line-height: 1.05;
          letter-spacing: -0.03em; color: #111; position: relative; z-index: 2;
        }
        .hero-text em { font-style: italic; }

        .ph-badge {
          position: absolute; top: 44px; right: 16px;
          width: 64px; height: 64px; border-radius: 50%;
          overflow: hidden; z-index: 3;
        }
        .ph-badge img { width: 100%; height: 100%; object-fit: cover; }

        /* SCORE BOX */
        .score-row { display: flex; align-items: center; gap: 0; margin-top: 6px; flex-wrap: nowrap; }
        .score-box {
          display: inline-flex; align-items: center; gap: 4px;
          border: 2px dashed #aaa; border-radius: 6px;
          padding: 4px 14px; margin-left: 10px;
          font-size: 48px; font-weight: 900; letter-spacing: -0.03em; color: #111;
          background: white; position: relative; overflow: hidden;
          min-width: 110px; justify-content: center;
        }
        .score-num {
          display: inline-block;
          transition: opacity 0.06s;
          filter: ${settled ? "none" : "blur(3px)"};
          opacity: ${settled ? "1" : "0.7"};
          min-width: 28px; text-align: center;
        }
        .score-slash { font-size: 48px; font-weight: 900; color: #111; }

        /* ARROW */
        .arrow-row { display: flex; justify-content: flex-start; padding: 8px 20px 0 28px; }
        .arrow-svg { width: 70px; opacity: 0.75; }

        /* TROPHY */
        .trophy-wrap {
          position: absolute; right: 10px; top: 0;
          width: 110px; z-index: 2;
        }
        .trophy-wrap img { width: 100%; }

        /* CARDS */
        .cards { padding: 0 20px; margin-top: 16px; display: flex; flex-direction: column; gap: 12px; position: relative; }

        .card {
          border-radius: 16px; background: #0000ff;
          color: white; padding: 20px 22px;
          font-size: 15px; line-height: 1.55; text-align: center;
        }
        .card strong { font-weight: 700; }
        .card em { font-style: italic; font-weight: 700; }

        /* SOCIALS */
        .socials { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 40px; }
        .social-icon {
          width: 44px; height: 44px; border-radius: 10px;
          background: #888; display: flex; align-items: center; justify-content: center;
          color: white; text-decoration: none; transition: background 0.15s;
          font-size: 20px;
        }
        .social-icon:hover { background: #0000ff; }
        .social-icon svg { width: 22px; height: 22px; fill: white; }

        /* CURSOR + FIRE */
        .bottom-wrap {
          position: relative; margin-top: 32px; height: 200px; overflow: hidden;
        }
        .cursor-img {
          position: absolute; left: 50%; top: 10px;
          transform: translateX(-20px);
          width: 80px; z-index: 3;
        }
        .fire-img {
          position: absolute; bottom: -20px; left: -10px;
          width: 180px; z-index: 2;
        }

        /* FOOTER */
        .footer {
          text-align: center; font-size: 12px; color: #999;
          padding: 0 20px 24px; margin-top: 16px;
        }

        @media (min-width: 500px) {
          .landing-root { max-width: 500px; }
          .hero-text { font-size: 52px; }
          .score-box { font-size: 52px; }
        }
      `}</style>

      <div className="landing-root">

        {/* NAV */}
        <nav className="nav">
          <img src="/ShyCombintorLogo.png" alt="Shy Combinator" className="nav-logo" />
          <Link href="/truth-serum" className="roast-btn">Roast Me</Link>
        </nav>

        {/* HERO */}
        <section className="hero">
          <div className="ph-badge">
            <img src="/product-hunt-logo-icon_2.png" alt="Product Hunt" />
          </div>

          <h1 className="hero-text">
            we <em>rate</em> our<br />
            product hunt<br />
            <span style={{ display: "flex", alignItems: "center", gap: "0px", flexWrap: "nowrap" }}>
              finds
              <span className="score-box">
                <span
                  className="score-num"
                  style={{
                    filter: settled ? "none" : "blur(3px)",
                    opacity: settled ? 1 : 0.6,
                    transition: "filter 0.15s, opacity 0.15s",
                  }}
                >
                  {displayNum}
                </span>
                <span className="score-slash">/10</span>
              </span>
            </span>
          </h1>

          {/* Curved arrow pointing down-left */}
          <div className="arrow-row">
            <svg className="arrow-svg" viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 8 C10 8, 60 10, 65 50" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <path d="M58 44 L65 50 L60 42" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Trophy — floats right, overlapping hero and cards */}
          <div className="trophy-wrap" style={{ top: "110px" }}>
            <img src="/trophy.png" alt="Trophy" />
          </div>
        </section>

        {/* CARDS */}
        <div className="cards">
          <div className="card">
            Early-stage tech founders are often invisible,<br />
            their products lost in an <em>insider echo chamber,</em><br />
            away from the users who&apos;d actually love them.
          </div>

          <div className="card" style={{ background: "#1a1aff" }}>
            <strong>Shy Combinator</strong> started as a parody,<br />
            built by two friends who admired Silicon Valley<br />
            innovation from the other side of the world.
          </div>

          <div className="card">
            We celebrate the builders, cut through the jargon, and
            give new tech the honest spotlight it deserves, because{" "}
            <em>great inventors shouldn&apos;t shy out from the world.</em>
          </div>
        </div>

        {/* SOCIAL ICONS */}
        <div className="socials">
          {/* X */}
          <a href="https://x.com/shycombinator" target="_blank" rel="noopener noreferrer" className="social-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
          {/* LinkedIn */}
          <a href="https://www.linkedin.com/company/shycombinator/" target="_blank" rel="noopener noreferrer" className="social-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          {/* Instagram */}
          <a href="https://instagram.com/shycombinator.co" target="_blank" rel="noopener noreferrer" className="social-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
          </a>
        </div>

        {/* CURSOR + FIRE */}
        <div className="bottom-wrap">
          <img src="/cursor.png" alt="" className="cursor-img" />
          <img src="/fire.png" alt="" className="fire-img" />
        </div>

        {/* FOOTER */}
        <div className="footer">© 2026 Dabloo Studios. All rights reserved.</div>
      </div>
    </main>
  );
}
