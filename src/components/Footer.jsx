import React from "react";
import { Link } from "react-router-dom";
import { Instagram, Twitter, Linkedin, Facebook } from "lucide-react";
import logo from "../assets/logo.png";
import "../styles/Footer.css";

/**
 * Shared Footer component — rendered on every public page (Landing, Services,
 * Service Detail) beneath the CTA banner. Styled via styles/Footer.css.
 */
export default function Footer() {
  return (
    <footer className="rp-footer">
      <div className="rp-container">
        <div className="rp-footer-top">
          <div>
            <div className="rp-logo">
              <img src={logo} alt="Retrofit Portal" className="rp-logo-img" />
              <span className="rp-logo-text">
                <div className="l1">RETROFIT</div>
                <div className="l2">PORTAL</div>
              </span>
            </div>
            <p className="rp-footer-tagline">
              A centralized digital platform designed to modernize and scale retrofit service delivery.
            </p>
            <div className="rp-socials">
              <a href="#" aria-label="Instagram" onClick={(e) => e.preventDefault()}><Instagram size={16} /></a>
              <a href="#" aria-label="Twitter" onClick={(e) => e.preventDefault()}><Twitter size={16} /></a>
              <a href="#" aria-label="LinkedIn" onClick={(e) => e.preventDefault()}><Linkedin size={16} /></a>
              <a href="#" aria-label="Facebook" onClick={(e) => e.preventDefault()}><Facebook size={16} /></a>
            </div>
          </div>

          <div>
            <h5>Pages</h5>
            <ul>
              <li><Link to="/">Home</Link></li>
              <li><Link to="/" state={{ scrollTo: "how-it-works" }}>How It Works</Link></li>
              <li><Link to="/services">Services</Link></li>
              <li><Link to="/feedbacks">Feedbacks</Link></li>
            </ul>
          </div>

          <div>
            <h5>Categories</h5>
            <ul>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/services/1">Service Detail</Link></li>
            </ul>
          </div>

          <div>
            <h5>Resources</h5>
            <ul>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms &amp; conditions</Link></li>
              <li><Link to="/changelog">Changelog</Link></li>
            </ul>
          </div>
        </div>

        <div className="rp-footer-bottom">Retrofit© 2026. All rights reserved.</div>
      </div>
    </footer>
  );
}