import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Footer from "../components/Footer";
import CtaBanner from "../components/CtaBanner";
import img01 from "../assets/01.png";
import img02 from "../assets/02.png";
import img03 from "../assets/03.png";
import imgTrust from "../assets/trust.png";
import { testimonials as TESTIMONIALS } from "../data/testimonials";
import { landingServices as SERVICES } from "../data/landingServices";
import { trustedLogos as LOGOS } from "../data/trustedLogos";
import "../styles/Landing.css";

/* ============================================================
   RETROFIT PORTAL — Landing Page
   Styled via external plain CSS in ../styles/Landing.css
   ============================================================ */

export default function LandingPage() {
  const [activeTestimonial, setActiveTestimonial] = useState(2);
  const [trackOffset, setTrackOffset] = useState(0);
  const wrapRef = useRef(null);
  const cardRefs = useRef([]);
  const navigate = useNavigate();
  const location = useLocation();
  const openVideoModal = () => {};

  useEffect(() => {
    const target = location.state?.scrollTo;
    if (target) {
      const id = window.setTimeout(() => {
        const el = document.getElementById(target);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        navigate(location.pathname, { replace: true, state: null });
      }, 100);
      return () => window.clearTimeout(id);
    }
  }, [location.state, location.pathname, navigate]);

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

  const trackStyle = { '--track-offset': `${trackOffset}px` };

  return (
    <div className="rp-root">
      <Header />

      <main>
      {/* ================= HERO ================= */}
      <section className="rp-hero" id="top">
        <div className="rp-container">
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
                <Link to="/services" className="rp-btn rp-btn-white">
                  Browse Services
                </Link>
                <button className="rp-btn rp-btn-outline-white" onClick={openVideoModal}>
                  Watch Video
                </button>
              </div>
            </div>

            <div className="rp-hero-media">
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
                <img src={imgTrust} alt="TrustMark Certified" />
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
            {LOGOS.map(({ name, icon: Icon }) => (
              <span key={name} className="rp-trusted-logo">
                <Icon size={16} />
                {name}
              </span>
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
      <section className="rp-section" id="services">
        <div className="rp-container">
          <div className="rp-section-head">
            <div className="rp-eyebrow">Services</div>
            <h2>Retrofit Services</h2>
            <div className="rp-viewall-wrap">
              <button className="rp-viewall" onClick={() => navigate("/services")}>View All</button>
            </div>
          </div>

          <div className="rp-services-grid">
            {SERVICES.map((s) => (
              <div className="rp-card" key={s.title}>
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
                  <Link to={`/services/${s.id}`} className="rp-btn rp-btn-primary">
                    View Details
                  </Link>
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
            <h2>Trusted By Thousands Of Homeowners And<br />Local Authorities.</h2>
          </div>

          <div className="rp-test-wrap" ref={wrapRef}>
            <div
              className="rp-test-track"
              style={trackStyle}
            >
              {TESTIMONIALS.map((t, i) => {
                const cardStyle = { '--test-z': TESTIMONIALS.length - Math.abs(i - activeTestimonial) };
                return (
                  <div
                    className={`rp-test-card ${i === activeTestimonial ? "active" : ""}`}
                    key={t.name + i}
                    ref={(el) => (cardRefs.current[i] = el)}
                    style={cardStyle}
                    role="button"
                    tabIndex={0}
                    aria-label={`Show testimonial from ${t.name}`}
                    onClick={() => setActiveTestimonial(i)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveTestimonial(i);
                      }
                    }}
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
                );
              })}
            </div>
          </div>

          <div className="rp-carousel-nav">
            <button className="rp-nav-btn" onClick={goPrev} aria-label="Previous testimonial">‹</button>
            <button className="rp-nav-btn" onClick={goNext} aria-label="Next testimonial">›</button>
          </div>
        </div>
      </section>

      {/* ================= CTA BANNER ================= */}
      <CtaBanner id="cta" ctaTo="/signup" />
      </main>

      {/* ================= FOOTER ================= */}
      <Footer />
    </div>
  );
}
