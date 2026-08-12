import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo.png";
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
 * Update the logo import path if your logo file lives elsewhere.
 */
export default function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link
            to="/how-it-works"
            className={location.pathname === "/how-it-works" ? "active" : ""}
          >
            How it Works
          </Link>
        </nav>

        <div className="header-actions">
          <Link to="/login" className="header-btn header-btn-login">
            Login
          </Link>
          <Link to="/get-started" className="header-btn header-btn-primary">
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
          <Link
            to="/how-it-works"
            className={location.pathname === "/how-it-works" ? "active" : ""}
            onClick={closeMenu}
          >
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
            to="/get-started"
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
