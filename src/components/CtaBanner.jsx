import { Link } from 'react-router-dom';
import ctaCollage from '../assets/Collage.png';
import '../styles/CtaBanner.css';

/**
 * Shared CTA banner ("Start Your Retrofit Project Today") shown at the
 * bottom of the Landing and Public Services pages.
 * `ctaTo` is the destination of the "Get Started" button.
 */
export default function CtaBanner({ ctaTo = '/get-started', id }) {
  return (
    <section className="rp-container rp-cta-section" id={id}>
      <div className="rp-cta-banner">
        <div>
          <div className="rp-avatars">
            <img src="https://i.pravatar.cc/60?img=5" alt="" />
            <img src="https://i.pravatar.cc/60?img=8" alt="" />
            <img src="https://i.pravatar.cc/60?img=15" alt="" />
            <img src="https://i.pravatar.cc/60?img=22" alt="" />
          </div>
          <h2>Start Your Retrofit Project Today</h2>
          <p>
            Join 500+ homeowners this month who secured funding and compliant designs through the
            Retrofit Portal.
          </p>
          <Link to={ctaTo} className="rp-cta-btn">
            Get Started
            <span className="rp-cta-btn-icon">→</span>
          </Link>
        </div>
        <div className="rp-cta-img-wrap rp-cta-img-desktop">
          <img src={ctaCollage} alt="Retrofit project collage" className="rp-cta-img" />
        </div>
      </div>
    </section>
  );
}