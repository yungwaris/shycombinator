"use client";

import Link from "next/link";

export default function Home() {

  return (
    <main className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,700;1,900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: white; }

        /* ── ROOT CONTAINER ── */
        .landing-root {
          max-width: 100%;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* ── NAV ── */
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 5% 0;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
        }
        .nav-logo {
          width: 140px;
          height: auto;
        }
        .roast-btn-wrap {
          display: block;
          text-decoration: none;
        }
        .roast-btn-img {
          height: 48px;
          width: auto;
          display: block;
          transition: transform 0.15s, filter 0.15s;
        }
        .roast-btn-img:hover {
          transform: scale(1.04);
          filter: brightness(1.1);
        }

        /* ── HERO ── */
        .hero {
          padding: 40px 5% 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .hero-inner {
          position: relative;
          width: 100%;
          max-width: 420px; /* Constrained smaller to reduce overall hero size */
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .we-rate-img {
          width: 100%;
          max-width: 380px; /* Reduced image size */
          height: auto;
          display: block;
        }

        /* ── ARROW ── */
        .arrow-row {
          width: 100%;
          display: flex;
          justify-content: flex-start;
          padding-left: 20px;
          margin-top: 5px;
        }
        .arrow-img {
          width: 80px;
          height: auto;
          display: block;
        }

        /* ── TROPHY ── */
        .trophy-wrap {
          position: absolute;
          right: -20px;
          bottom: 0px; 
          width: 90px;
          z-index: 2;
        }
        .trophy-wrap img {
          width: 100%;
          height: auto;
        }

        /* ── CARDS ── */
        .cards-container {
          max-width: 1200px;
          width: 100%;
          margin: 40px auto 0;
          padding: 0 5%;
        }
        .cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .card {
          border-radius: 16px;
          background: #0000ff;
          color: white;
          padding: 24px;
          font-size: 16px;
          line-height: 1.6;
          text-align: center; 
          font-family: 'Inter', sans-serif;
        }
        .card strong { font-weight: 700; }
        .card em { font-style: italic; font-weight: 700; }

        /* ── SOCIALS ── */
        .socials {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-top: 32px;
        }
        .social-icon {
          width: 48px;
          height: 48px;
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
        .social-icon svg { width: 24px; height: 24px; fill: white; }

        /* ── BOTTOM STICKY AREA ── */
        .bottom-area {
          flex-grow: 1; 
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          position: relative;
          margin-top: 100px; /* Big gap to push graphics far below cards */
          min-height: 250px;
        }
        .graphics-container {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%; /* Spans full width to prevent clipping */
          height: 100%;
          pointer-events: none;
        }
        .cursor-img {
          position: absolute;
          top: 0px;
          left: 50%;
          transform: translateX(-50%);
          width: 90px;
          height: auto;
          z-index: 3;
        }
        .fire-img {
          position: absolute;
          bottom: -10px;
          left: 10%;
          width: 140px;
          height: auto;
          z-index: 2;
        }
        .michael-img {
          position: absolute;
          bottom: 0;
          right: 0; /* Anchored flush to the absolute right of screen */
          width: 250px;
          height: auto;
          z-index: 0; /* Placed behind the footer text just in case */
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

        /* ── RESPONSIVE ── */
        @media (max-width: 480px) {
          .nav-logo { width: 100px; }
          .roast-btn-img { height: 40px; }
          .card { font-size: 14px; padding: 20px 18px; }
          .hero-inner { max-width: 100%; }
          .we-rate-img { max-width: 300px; }
          .fire-img { left: -10px; }
          .michael-img { width: 180px; }
          .trophy-wrap { right: 0px; width: 70px; }
        }

        @media (min-width: 768px) {
          .cards {
            grid-template-columns: repeat(3, 1fr);
            gap: 24px;
          }
          .arrow-row { padding-left: 40px; }
          .trophy-wrap {
            right: -50px;
            bottom: -10px;
            width: 100px;
          }
          .cursor-img { width: 100px; }
          .fire-img { width: 180px; left: 15%; }
          .michael-img { width: 280px; }
        }
      `}</style>

      <div className="landing-root">

        {/* ── NAV ── */}
        <nav className="nav">
          <img src="/ShyCombintorLogo.png" alt="Shy Combinator" className="nav-logo" />
          <a href="http://shycombinator.co/truth-serum/" className="roast-btn-wrap">
            <img src="/truthserum_button.png" alt="Truth Serum" className="roast-btn-img" />
          </a>
        </nav>

        {/* ── HERO ── */}
        <section className="hero">
          <div className="hero-inner">
            {/* "we rate our product hunt finds X/10" as image */}
            <img src="/we_rate.png" alt="we rate our product hunt finds" className="we-rate-img" />

            {/* Curved arrow */}
            <div className="arrow-row">
              <img src="/arrow1.png" alt="" className="arrow-img" />
            </div>

            {/* Trophy — floats bottom right of text */}
            <div className="trophy-wrap">
              <img src="/trophy.png" alt="Trophy" />
            </div>
          </div>
        </section>

        {/* ── CARDS & SOCIALS ── */}
        <div className="cards-container">
          <div className="cards">
            {/* Hard <br /> tags removed to let CSS Grid naturally wrap the text */}
            <div className="card">
              Early-stage tech founders are often invisible, their products lost in an <em>insider echo chamber,</em> away from the users who&apos;d actually love them.
            </div>

            <div className="card" style={{ background: "#1a1aff" }}>
              <strong>Shy Combinator</strong> started as a parody, built by two friends who admired Silicon Valley innovation from the other side of the world.
            </div>

            <div className="card">
              We celebrate the builders, cut through the jargon, and give new tech the honest spotlight it deserves, because <em>great inventors shouldn&apos;t shy out from the world.</em>
            </div>
          </div>

          {/* ── SOCIAL ICONS ── */}
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
        </div>

        {/* ── BOTTOM ANCHORED AREA ── */}
        <div className="bottom-area">
          <div className="graphics-container">
            <img src="/cursor.png" alt="" className="cursor-img" />
            <img src="/fire.png" alt="" className="fire-img" />
            <img src="/MichaelShyComb.png" alt="" className="michael-img" />
          </div>
          
          <div className="footer">
            <img src="/dabloo_logo.png" alt="Dabloo Studios" className="footer-logo" />
            © 2026 Dabloo Studios. All rights reserved.
          </div>
        </div>

      </div>
    </main>
  );
}