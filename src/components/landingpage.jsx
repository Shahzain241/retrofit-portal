import React, { useState, useEffect, useRef } from "react";
import img01 from "../assets/01.png";
import img02 from "../assets/02.png";
import img03 from "../assets/03.png";
import imgAssessment from "../assets/Assessmet.png";
import imgDesign from "../assets/Design.png";
import imgCoordination from "../assets/Coordination.png";
import imgLogo from "../assets/logo.png";

/* ============================================================
   RETROFIT PORTAL — Landing Page
   Single-file React component (self-contained styles, no
   external CSS/Tailwind dependency required).
   ============================================================ */

const TESTIMONIALS = [
  {
    name: "James Sterling",
    role: "Homeowner, London",
    rating: 5,
    text: "The platform made navigating PAS 2035 compliance simple. I received my assessment within a week and the coordinator was incredibly helpful.",
    avatar: "https://i.pravatar.cc/100?img=12",
  },
  {
    name: "Amara Whitfield",
    role: "Homeowner, Manchester",
    rating: 5,
    text: "From quote to completion in under six weeks. Funding paperwork was handled entirely by the team — I barely lifted a finger.",
    avatar: "https://i.pravatar.cc/100?img=32",
  },
  {
    name: "Oliver Bancroft",
    role: "Homeowner, Bristol",
    rating: 5,
    text: "Transparent pricing, real-time updates, and a compliance certificate the day works finished. Exactly what was promised.",
    avatar: "https://i.pravatar.cc/100?img=51",
  },
  {
    name: "Priya Nandan",
    role: "Local Authority, Leeds",
    rating: 4,
    text: "We rolled this out across 40 council properties. The audit-ready documentation alone saved our team weeks of admin work.",
    avatar: "https://i.pravatar.cc/100?img=47",
  },
  {
    name: "Callum Reyes",
    role: "Homeowner, Leeds",
    rating: 5,
    text: "Genuinely impressed with the heavy-lifting they handled — surveys, design, installation, all coordinated without me chasing anyone.",
    avatar: "https://i.pravatar.cc/100?img=15",
  },
];

const SERVICES = [
  {
    tag: "PAS 2035",
    title: "Retrofit Assessment",
    price: "$69",
    desc: "Complete on-site measurement and energy modeling for compliance.",
    img: imgAssessment,
  },
  {
    tag: "PAS 2035",
    title: "Design Package",
    price: "$69",
    desc: "Detailed technical drawings and thermal bridging calculations.",
    img: imgDesign,
  },
  {
    tag: "PAS 2035",
    title: "Retrofit Coordination",
    price: "$69",
    desc: "End-to-end management from risk assessment to final sign-off.",
    img: imgCoordination,
  },
];

const LOGOS = ["Design", "Optimal", "Emblem", "Wayline", "Nietzsche"];

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(2);
  const [trackOffset, setTrackOffset] = useState(0);
  const wrapRef = useRef(null);
  const cardRefs = useRef([]);

  const goPrev = () =>
    setActiveTestimonial((i) => (i - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  const goNext = () =>
    setActiveTestimonial((i) => (i + 1) % TESTIMONIALS.length);

  // Auto-advance carousel every 5s
  useEffect(() => {
    const id = setInterval(goNext, 5000);
    return () => clearInterval(id);
  }, []);

  // Recenter the active card by measuring real rendered widths, so the
  // overlapping stack stays centered and correct at any screen size.
  useEffect(() => {
    function recenter() {
      const wrap = wrapRef.current;
      const card = cardRefs.current[activeTestimonial];
      if (!wrap || !card) return;
      const wrapWidth = wrap.offsetWidth;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      setTrackOffset(wrapWidth / 2 - cardCenter);
    }
    recenter();
    window.addEventListener("resize", recenter);
    return () => window.removeEventListener("resize", recenter);
  }, [activeTestimonial]);

  const scrollToId = (id) => (e) => {
    e.preventDefault();
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="rp-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        .rp-root, .rp-root * { box-sizing: border-box; }
        .rp-root {
          --navy: #0b2a3d;
          --navy-deep: #0a2233;
          --teal: #0f3b3e;
          --teal-dark: #0c2f31;
          --mint: #35b378;
          --mint-soft: #cfe9db;
          --mint-pale: rgba(53,179,120,0.12);
          --ink: #10241f;
          --gray: #66766f;
          --gray-light: #93a19b;
          --bg-soft: #f6f8f6;
          --border: #e4e9e5;
          --white: #ffffff;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: var(--ink);
          background: var(--white);
          overflow-x: hidden;
        }
        .rp-root h1, .rp-root h2, .rp-root h3, .rp-root h4 {
          font-family: 'Poppins', 'Inter', sans-serif;
          margin: 0;
          color: var(--ink);
        }
        .rp-root p { margin: 0; }
        .rp-root a { text-decoration: none; color: inherit; }
        .rp-root button { font-family: inherit; cursor: pointer; border: none; }
        .rp-root ul { list-style: none; margin: 0; padding: 0; }
        .rp-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .rp-eyebrow {
          color: var(--mint);
          font-weight: 600;
          font-size: 14px;
          letter-spacing: 0.02em;
        }

        /* ---------- HEADER ---------- */
        .rp-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: var(--white);
          border-bottom: 1px solid var(--border);
        }
        .rp-nav {
          max-width: 1200px;
          margin: 0 auto;
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .rp-logo { display: flex; align-items: center; gap: 9px; }
        .rp-logo-img { width: 28px; height: 35px; object-fit: contain; }
        .rp-logo-mark {
          position: relative;
          width: 30px; height: 30px;
          flex-shrink: 0;
        }
        .rp-logo-mark .a {
          position: absolute; left: 0; top: 0;
          width: 20px; height: 20px;
          background: var(--navy);
          border-radius: 3px 3px 3px 0;
        }
        .rp-logo-mark .b {
          position: absolute; left: 0; bottom: 0;
          width: 12px; height: 5px;
          background: var(--mint);
          border-radius: 2px;
        }
        .rp-logo-text { line-height: 1.05; }
        .rp-logo-text .l1 { font-weight: 700; font-size: 16px; letter-spacing: 0.05em; color: var(--navy); }
        .rp-logo-text .l2 { font-weight: 500; font-size: 11px; letter-spacing: 0.22em; color: var(--gray); }
        .rp-navlinks {
          display: flex; align-items: center; gap: 32px;
          font-weight: 500; font-size: 15px;
        }
        .rp-navlinks a { color: var(--ink); transition: color .15s; }
        .rp-navlinks a:hover { color: var(--mint); }
        .rp-nav-actions { display: flex; align-items: center; gap: 12px; }
        .rp-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 22px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 14px;
          transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
          white-space: nowrap;
        }
        .rp-btn:hover { transform: translateY(-1px); }
        .rp-btn-primary { background: var(--teal); color: white; }
        .rp-btn-primary:hover { background: var(--teal-dark); box-shadow: 0 8px 20px rgba(15,59,62,0.25); }
        .rp-btn-outline-dark { background: white; color: var(--ink); border: 1px solid var(--border); padding: 10px 22px; }
        .rp-btn-outline-dark:hover { border-color: var(--ink); }
        .rp-btn-white { background: white; color: var(--ink); }
        .rp-btn-white:hover { box-shadow: 0 8px 20px rgba(0,0,0,0.18); }
        .rp-btn-outline-white { background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.5); }
        .rp-btn-outline-white:hover { background: rgba(255,255,255,0.18); }
        .rp-card .rp-btn-primary { border-radius: 10px; }
        .rp-burger { display: none; background: none; padding: 6px; }
        .rp-burger span { display:block; width: 22px; height: 2px; background: var(--ink); margin: 5px 0; border-radius: 2px; }

        /* ---------- HERO ---------- */
        .rp-hero {
          position: relative;
          height: 560px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: linear-gradient(100deg, rgba(9,22,34,0.66) 20%, rgba(9,22,34,0.38) 65%, rgba(9,22,34,0.5) 100%),
                      url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80') center/cover no-repeat;
          color: white;
          padding: 40px 0;
        }
        .rp-hero-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 24px;
        }
        .rp-hero-inner { max-width: 420px; }
        .rp-hero h1 { font-size: 40px; font-weight: 700; line-height: 1.18; letter-spacing: -0.01em; color: #ffffff; }
        .rp-hero p.rp-sub { margin-top: 18px; font-size: 15px; line-height: 1.65; color: rgba(255,255,255,0.82); max-width: 340px; }
        .rp-hero-actions { margin-top: 26px; display: flex; gap: 14px; flex-wrap: wrap; }
        .rp-hero-actions .rp-btn { padding: 12px 24px; font-size: 14px; }
        .rp-hero-stats { display: flex; gap: 38px; flex-wrap: wrap; padding-bottom: 6px; }
        .rp-stat .num { font-size: 26px; font-weight: 700; font-family: 'Poppins', sans-serif; }
        .rp-stat .label { font-size: 12.5px; color: rgba(255,255,255,0.7); margin-top: 4px; white-space: nowrap; }
        .rp-trustbadge {
          position: relative;
          width: 74px; height: 74px; border-radius: 50%;
          border: 1px dashed rgba(255,255,255,0.5);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.85);
          flex-shrink: 0;
        }
        .rp-trustbadge-inner {
          width: 34px; height: 34px; border-radius: 50%; background: white;
          display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--navy);
        }
        .rp-trustbadge-ring {
          position: absolute; inset: 0;
          animation: rp-spin 14s linear infinite;
        }
        @keyframes rp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* ---------- TRUSTED STRIP ---------- */
        .rp-trusted {
          padding: 48px 0;
          text-align: center;
          background: var(--white);
        }
        .rp-trusted h4 { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 28px; }
        .rp-logo-row { display: flex; justify-content: center; align-items: center; gap: 48px; flex-wrap: wrap; opacity: 0.5; }
        .rp-logo-row span { font-weight: 700; font-size: 15px; font-family: 'Poppins', sans-serif; color: #9aa5a0; }

        /* ---------- HOW IT WORKS ---------- */
        .rp-section { padding: 90px 0; }
        .rp-section.alt { background: var(--bg-soft); }
        .rp-section-head { text-align: center; max-width: 640px; margin: 0 auto 44px; }
        .rp-section-head h2 { font-size: 32px; font-weight: 700; margin-top: 8px; line-height: 1.25; }

        .rp-hiw-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }
        .rp-hiw-cell {
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          min-height: 280px;
          display: flex;
        }
        .rp-hiw-cell.img { padding: 0; }
        .rp-hiw-cell.img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .rp-hiw-cell.text {
          flex-direction: column;
          justify-content: center;
          padding: 32px 44px;
        }
        .rp-step-num {
          font-family: 'Poppins', sans-serif;
          font-size: 52px; font-weight: 800;
          color: var(--mint-soft);
          line-height: 1;
          margin-bottom: 14px;
        }
        .rp-hiw-cell.text h3 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
        .rp-hiw-cell.text p { color: var(--gray); font-size: 14.5px; line-height: 1.6; max-width: 340px; }

        /* ---------- SERVICES ---------- */
        .rp-viewall-wrap { text-align: center; margin-top: 8px; }
        .rp-viewall { display: inline-block; color: var(--mint); font-weight: 600; font-size: 14px; position: relative; padding-bottom: 8px; }
        .rp-viewall::after {
          content: ""; position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
          width: 36px; height: 0; border-bottom: 1.5px dashed var(--mint);
        }
        .rp-services-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
          margin-top: 48px;
        }
        .rp-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          transition: box-shadow .2s ease, transform .2s ease;
        }
        .rp-card:hover { box-shadow: 0 16px 32px rgba(16,36,31,0.1); transform: translateY(-3px); }
        .rp-card.featured { border: 1.5px dashed var(--mint); }
        .rp-card img { width: 100%; height: 150px; object-fit: cover; display: block; }
        .rp-card-body { padding: 18px 20px 22px; }
        .rp-card-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
        .rp-card-tags { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .rp-tag {
          background: var(--mint-pale); color: var(--mint);
          font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
          white-space: nowrap;
        }
        .rp-card-title { font-size: 16.5px; font-weight: 700; }
        .rp-price { color: var(--mint); font-weight: 700; font-size: 16px; flex-shrink: 0; }
        .rp-card-desc { color: var(--gray); font-size: 14px; line-height: 1.55; margin-bottom: 18px; min-height: 42px; }
        .rp-card .rp-btn { width: 100%; }

        /* ---------- TESTIMONIALS ---------- */
        .rp-test-wrap { position: relative; overflow: hidden; padding: 20px 0 12px; }
        .rp-test-track {
          display: flex;
          transition: transform .45s cubic-bezier(.22,.61,.36,1);
          padding: 6px 4px;
          will-change: transform;
        }
        .rp-test-card {
          flex: 0 0 320px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 26px;
          margin-left: -58px;
          cursor: pointer;
          transition: transform .4s cubic-bezier(.22,.61,.36,1), box-shadow .4s ease;
          box-shadow: 0 10px 22px rgba(16,36,31,0.08);
          transform: scale(0.94);
        }
        .rp-test-card:first-child { margin-left: 0; }
        .rp-test-card.active { transform: scale(1.03); box-shadow: 0 26px 50px rgba(16,36,31,0.18); }
        .rp-stars { color: var(--mint); font-size: 14px; letter-spacing: 2px; margin-bottom: 14px; }
        .rp-test-text { font-size: 14.5px; line-height: 1.65; color: var(--ink); font-style: italic; margin-bottom: 20px; min-height: 90px; }
        .rp-test-person { display: flex; align-items: center; gap: 12px; }
        .rp-test-avatar {
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
          background: var(--mint-pale); color: var(--teal);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 13px; font-family: 'Poppins', sans-serif;
        }
        .rp-test-person .n { font-weight: 700; font-size: 14px; }
        .rp-test-person .r { font-size: 11px; color: var(--gray); text-transform: uppercase; letter-spacing: 0.03em; margin-top: 2px; }
        .rp-carousel-nav { display: flex; justify-content: center; gap: 12px; margin-top: 36px; }
        .rp-nav-btn {
          width: 40px; height: 40px; border-radius: 50%;
          background: var(--teal); border: none;
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 16px; transition: background .15s;
        }
        .rp-nav-btn:hover { background: var(--teal-dark); }

        /* ---------- CTA BANNER ---------- */
        .rp-cta-banner {
          margin: 20px auto 0;
          max-width: 1200px;
          border-radius: 28px;
          background: linear-gradient(120deg, var(--navy-deep), var(--navy) 60%, #123244);
          padding: 56px 56px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          align-items: center;
          gap: 40px;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .rp-avatars { display: flex; margin-bottom: 20px; }
        .rp-avatars img {
          width: 34px; height: 34px; border-radius: 50%; object-fit: cover;
          border: 2px solid var(--navy); margin-right: -10px;
        }
        .rp-cta-banner h2 { font-size: 28px; font-weight: 700; max-width: 380px; color: #ffffff; }
        .rp-cta-banner p { color: rgba(255,255,255,0.72); font-size: 14.5px; margin-top: 12px; max-width: 400px; line-height: 1.6; }
        .rp-cta-banner .rp-btn { margin-top: 26px; }
        .rp-cta-media { position: relative; height: 240px; }
        .rp-cta-circle {
          position: absolute; inset: 10% 18%;
          border-radius: 50%;
          border: 10px solid var(--mint);
          opacity: 0.9;
        }
        .rp-cta-media img {
          position: absolute; border-radius: 14px; object-fit: cover;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .rp-cta-img1 { width: 130px; height: 100px; left: 0; top: 10px; }
        .rp-cta-img2 { width: 150px; height: 110px; right: 0; top: 0; }
        .rp-cta-img3 { width: 140px; height: 105px; right: 30px; bottom: -10px; }

        /* ---------- FOOTER ---------- */
        .rp-footer { background: var(--bg-soft); padding-top: 72px; border-top: 1px solid var(--border); }
        .rp-footer-top { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 40px; padding-bottom: 56px; }
        .rp-footer-tagline { color: var(--gray); font-size: 14px; margin-top: 14px; max-width: 260px; line-height: 1.6; }
        .rp-footer h5 { font-size: 15px; font-weight: 700; margin-bottom: 18px; }
        .rp-footer ul li { margin-bottom: 12px; }
        .rp-footer ul li a { color: var(--gray); font-size: 14px; transition: color .15s; }
        .rp-footer ul li a:hover { color: var(--mint); }
        .rp-socials { display: flex; gap: 10px; margin-top: 22px; }
        .rp-socials a {
          width: 34px; height: 34px; border-radius: 50%; border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--gray);
          transition: all .15s;
        }
        .rp-socials a:hover { background: var(--teal); color: white; border-color: var(--teal); }
        .rp-footer-bottom {
          border-top: 1px solid var(--border);
          padding: 22px 0;
          text-align: center;
          font-size: 13px;
          color: var(--gray);
        }

        /* ---------- RESPONSIVE ---------- */
        @media (max-width: 980px) {
          .rp-navlinks { display: none; }
          .rp-burger { display: block; }
          .rp-hero { height: auto; padding: 60px 0 32px; }
          .rp-hero-row { flex-direction: column; align-items: flex-start; gap: 32px; }
          .rp-hero h1 { font-size: 34px; }
          .rp-hiw-grid { grid-template-columns: 1fr; }
          .rp-hiw-cell { min-height: 220px; }
          .rp-services-grid { grid-template-columns: 1fr 1fr; }
          .rp-test-card { flex-basis: 260px; margin-left: -46px; }
          .rp-cta-banner { grid-template-columns: 1fr; padding: 40px 28px; text-align: left; }
          .rp-cta-media { height: 200px; margin-top: 12px; }
          .rp-footer-top { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 640px) {
          .rp-container { padding: 0 18px; }
          .rp-hero { padding: 60px 0 32px; height: auto; }
          .rp-hero h1 { font-size: 26px; }
          .rp-hero-stats { gap: 22px; }
          .rp-trustbadge { display: none; }
          .rp-section { padding: 56px 0; }
          .rp-section-head h2 { font-size: 26px; }
          .rp-services-grid { grid-template-columns: 1fr; }
          .rp-nav-actions .rp-btn-outline-dark { display: none; }
          .rp-logo-row { gap: 28px; }
          .rp-footer-top { grid-template-columns: 1fr 1fr; gap: 28px; }
          .rp-test-card { flex-basis: 78vw; margin-left: -34px; padding: 20px; }
        }
        @media (max-width: 420px) {
          .rp-footer-top { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ================= HEADER ================= */}
      <header className="rp-header">
        <nav className="rp-nav">
          <a href="#top" className="rp-logo" onClick={scrollToId("top")}>
            <img src={imgLogo} alt="Retrofit Portal" className="rp-logo-img" />
            <span className="rp-logo-text">
              <div className="l1">RETROFIT</div>
              <div className="l2">PORTAL</div>
            </span>
          </a>

          <div className="rp-navlinks">
            <a href="#services" onClick={scrollToId("services")}>Services</a>
            <a href="#how-it-works" onClick={scrollToId("how-it-works")}>How it Works</a>
          </div>

          <div className="rp-nav-actions">
            <button className="rp-btn rp-btn-outline-dark" onClick={() => alert("Login flow goes here")}>Login</button>
            <button className="rp-btn rp-btn-primary" onClick={scrollToId("cta")}>Get Started</button>
            <button className="rp-burger" aria-label="Menu" onClick={() => setMobileNavOpen((v) => !v)}>
              <span /><span /><span />
            </button>
          </div>
        </nav>
        {mobileNavOpen && (
          <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <a href="#services" onClick={scrollToId("services")}>Services</a>
            <a href="#how-it-works" onClick={scrollToId("how-it-works")}>How it Works</a>
          </div>
        )}
      </header>

      {/* ================= HERO ================= */}
      <section className="rp-hero" id="top">
        <div className="rp-container" style={{ width: "100%" }}>
          <div className="rp-hero-row">
            <div className="rp-hero-inner">
              <h1>
                Retrofit Your Home In<br />
                Weeks, Not Months —<br />
                Fully Compliant &amp; Funded
              </h1>
              <p className="rp-sub">
                Purchase PAS 2035 retrofit services online with transparent pricing, funding support, and end-to-end project coordination.
              </p>
              <div className="rp-hero-actions">
                <button className="rp-btn rp-btn-white" onClick={scrollToId("services")}>Browse Services</button>
                <button className="rp-btn rp-btn-outline-white" onClick={() => alert("Video player goes here")}>▶ Watch Video</button>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
              <div className="rp-hero-stats">
                <div className="rp-stat">
                  <div className="num">1K+</div>
                  <div className="label">Homes Retrofitted</div>
                </div>
                <div className="rp-stat">
                  <div className="num">2.4M</div>
                  <div className="label">Funding Secured</div>
                </div>
                <div className="rp-stat">
                  <div className="num">4.9/5</div>
                  <div className="label">Average Rating</div>
                </div>
              </div>
              <div className="rp-trustbadge">
                <div className="rp-trustbadge-inner">🛡</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUSTED STRIP ================= */}
      <section className="rp-trusted">
        <div className="rp-container">
          <h4>Official Trustmark Installer</h4>
          <div className="rp-logo-row">
            {LOGOS.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="rp-section" id="how-it-works">
        <div className="rp-container">
          <div className="rp-section-head">
            <div className="rp-eyebrow">How It Works</div>
            <h2>From Interest To Completion In Weeks</h2>
          </div>

          <div className="rp-hiw-grid">
            <div className="rp-hiw-cell img">
              <img src={img01} alt="Choose your service" />
            </div>
            <div className="rp-hiw-cell text">
              <div className="rp-step-num">01</div>
              <h3>Choose your service</h3>
              <p>Browse our transparent service catalogue. Select assessment, design, coordination or full package.</p>
            </div>

            <div className="rp-hiw-cell text">
              <div className="rp-step-num">02</div>
              <h3>We do the heavy lifting</h3>
              <p>Certified team manages surveys, design, funding, installation and full PAS 2035 compliance.</p>
            </div>
            <div className="rp-hiw-cell img">
              <img src={img02} alt="We do the heavy lifting" />
            </div>

            <div className="rp-hiw-cell img">
              <img src={img03} alt="Receive deliverables" />
            </div>
            <div className="rp-hiw-cell text">
              <div className="rp-step-num">03</div>
              <h3>Receive deliverables</h3>
              <p>Final report, compliance certificate, photos and all audit-ready documentation.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SERVICES ================= */}
      <section className="rp-section alt" id="services">
        <div className="rp-container">
          <div className="rp-section-head">
            <div className="rp-eyebrow">Services</div>
            <h2>Retrofit Services</h2>
            <div className="rp-viewall-wrap">
              <a href="#services" className="rp-viewall" onClick={(e) => e.preventDefault()}>View All</a>
            </div>
          </div>

          <div className="rp-services-grid">
            {SERVICES.map((s, idx) => (
              <div className={`rp-card ${idx === 0 ? "featured" : ""}`} key={s.title}>
                <img src={s.img} alt={s.title} />
                <div className="rp-card-body">
                  <div className="rp-card-top">
                    <div className="rp-card-tags">
                      <span className="rp-card-title">{s.title}</span>
                      <span className="rp-tag">{s.tag}</span>
                    </div>
                    <span className="rp-price">{s.price}</span>
                  </div>
                  <p className="rp-card-desc">{s.desc}</p>
                  <button className="rp-btn rp-btn-primary" onClick={() => alert(`Opening details for ${s.title}`)}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section className="rp-section" id="testimonials">
        <div className="rp-container">
          <div className="rp-section-head">
            <div className="rp-eyebrow">Testimonial's</div>
            <h2>Trusted By Thousands Of Homeowners And Local Authorities.</h2>
          </div>

          <div className="rp-test-wrap" ref={wrapRef}>
            <div
              className="rp-test-track"
              style={{ transform: `translateX(${trackOffset}px)` }}
            >
              {TESTIMONIALS.map((t, i) => (
                <div
                  className={`rp-test-card ${i === activeTestimonial ? "active" : ""}`}
                  key={t.name + i}
                  ref={(el) => (cardRefs.current[i] = el)}
                  style={{ zIndex: TESTIMONIALS.length - Math.abs(i - activeTestimonial) }}
                  onClick={() => setActiveTestimonial(i)}
                >
                  <div className="rp-stars">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</div>
                  <p className="rp-test-text">&ldquo;{t.text}&rdquo;</p>
                  <div className="rp-test-person">
                    <div className="rp-test-avatar">
                      {t.name.split(" ").map((w) => w[0]).join("")}
                    </div>
                    <div>
                      <div className="n">{t.name}</div>
                      <div className="r">{t.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rp-carousel-nav">
            <button className="rp-nav-btn" onClick={goPrev} aria-label="Previous testimonial">‹</button>
            <button className="rp-nav-btn" onClick={goNext} aria-label="Next testimonial">›</button>
          </div>
        </div>
      </section>

      {/* ================= CTA BANNER ================= */}
      <section className="rp-container" id="cta" style={{ paddingBottom: 90 }}>
        <div className="rp-cta-banner">
          <div>
            <div className="rp-avatars">
              <img src="https://i.pravatar.cc/60?img=5" alt="" />
              <img src="https://i.pravatar.cc/60?img=8" alt="" />
              <img src="https://i.pravatar.cc/60?img=15" alt="" />
              <img src="https://i.pravatar.cc/60?img=22" alt="" />
            </div>
            <h2>Start Your Retrofit Project Today</h2>
            <p>Join 500+ homeowners this month who secured funding and compliant designs through the Retrofit Portal.</p>
            <button className="rp-btn rp-btn-white" onClick={() => alert("Opening sign-up flow")}>
              Get Started &nbsp;→
            </button>
          </div>
          <div className="rp-cta-media">
            <div className="rp-cta-circle" />
            <img className="rp-cta-img1" src="https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=300&q=80" alt="" />
            <img className="rp-cta-img2" src="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=300&q=80" alt="" />
            <img className="rp-cta-img3" src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=300&q=80" alt="" />
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="rp-footer">
        <div className="rp-container">
          <div className="rp-footer-top">
            <div>
              <div className="rp-logo">
                <img src={imgLogo} alt="Retrofit Portal" className="rp-logo-img" />
                <span className="rp-logo-text">
                  <div className="l1">RETROFIT</div>
                  <div className="l2">PORTAL</div>
                </span>
              </div>
              <p className="rp-footer-tagline">
                A centralized digital platform designed to modernize and scale retrofit service delivery.
              </p>
              <div className="rp-socials">
                <a href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}>◎</a>
                <a href="#" aria-label="X" onClick={(e) => e.preventDefault()}>𝕏</a>
                <a href="#" aria-label="LinkedIn" onClick={(e) => e.preventDefault()}>in</a>
                <a href="#" aria-label="Link" onClick={(e) => e.preventDefault()}>⚭</a>
              </div>
            </div>

            <div>
              <h5>Pages</h5>
              <ul>
                <li><a href="#top" onClick={scrollToId("top")}>Home</a></li>
                <li><a href="#how-it-works" onClick={scrollToId("how-it-works")}>How It Works</a></li>
                <li><a href="#services" onClick={scrollToId("services")}>Services</a></li>
                <li><a href="#testimonials" onClick={scrollToId("testimonials")}>Feedbacks</a></li>
              </ul>
            </div>

            <div>
              <h5>Categories</h5>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Dashboard</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Service Detail</a></li>
              </ul>
            </div>

            <div>
              <h5>Resources</h5>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Privacy Policy</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Terms &amp; conditions</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Changelog</a></li>
              </ul>
            </div>
          </div>

          <div className="rp-footer-bottom">Retrofit© 2026. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
