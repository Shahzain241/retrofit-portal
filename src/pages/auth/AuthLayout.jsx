import logo from '../../assets/logo.png';
import '../../styles/AuthLayout.css';

export default function AuthLayout({ image, children }) {
  const sideImageStyle = { '--auth-bg': `url(${image})` };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div
        className="hidden lg:block bg-cover bg-center auth-side-image"
        style={sideImageStyle}
      />
      <main className="flex items-center justify-center px-4 sm:px-8 py-10 sm:py-12">
        <div className="w-full max-w-md auth-form-container">
          <div className="flex items-center gap-1 text-2xl font-semibold text-ink mb-10">
            <img src={logo} alt="Retrofit Portal" className="w-[42.86px] h-[53.92px] shrink-0 object-contain" />
            <span>
              <span className="auth-logo-title">RETROFIT</span>
              <div className="auth-logo-sub">PORTAL</div>
            </span>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
