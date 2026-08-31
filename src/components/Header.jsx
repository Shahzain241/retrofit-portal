import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
import { useAuth } from "../context/AuthContext";
import "../styles/Header.css";

/**
 * Retrofit Portal — Header / Navbar
 * ----------------------------------
 * Drop into src/components/Header.jsx (and Header.css next to it).
 * Import and render at the top of every page:
 *
 *   import Header from "../components/Header";
 *   ...
 *   <Header />
 *
 * Props:
 *   hideWhenAuthed (bool, default false) — when true AND the user has an active
 *   session (useAuth → getSession + onAuthStateChange, the same source
 *   ProtectedRoute uses), the WHOLE header renders nothing. Used by
 *   Services/ServiceDetail so signed-in users don't see the public navbar.
 *   Landing intentionally does NOT pass it: its header + Login/Get Started
 *   always render regardless of auth state.
 *
 * When not hidden, Login + Get Started are ALWAYS shown (no auth gating).
 */
export default function Header({ hideWhenAuthed = false }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session } = useAuth();

  if (hideWhenAuthed && session) {
    return null;
  }

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="header-wrapper">
      <div className="header-bar">
        <Link to="/" className="header-logo" onClick={closeMenu}>
          <img src={logo} alt="Retrofit Portal" />
          <span className="header-logo-text">
            <span className="header-logo-title">RETROFIT</span>
            <span className="header-logo-sub">PORTAL</span>
          </span>
        </Link>

        <nav className="header-nav">
          <Link
            to="/services"
            className={location.pathname.startsWith("/services") ? "active" : ""}
          >
            Services
          </Link>
          <Link to="/" state={{ scrollTo: "how-it-works" }}>
            How it Works
          </Link>
        </nav>

        <div className="header-actions">
          <Link to="/login" className="header-btn header-btn-login">
            Login
          </Link>
          <Link to="/signup" className="header-btn header-btn-primary">
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className={`header-burger ${menuOpen ? "header-burger-open" : ""}`}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div
        className={`header-mobile-menu ${
          menuOpen ? "header-mobile-menu-open" : ""
        }`}
      >
        <nav className="header-mobile-nav">
          <Link
            to="/services"
            className={location.pathname.startsWith("/services") ? "active" : ""}
            onClick={closeMenu}
          >
            Services
          </Link>
          <Link to="/" state={{ scrollTo: "how-it-works" }} onClick={closeMenu}>
            How it Works
          </Link>
          <Link
            to="/login"
            className="header-mobile-link header-mobile-link-login"
            onClick={closeMenu}
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="header-mobile-link header-mobile-link-primary"
            onClick={closeMenu}
          >
            Get Started
          </Link>
        </nav>
      </div>
    </div>
  );
}