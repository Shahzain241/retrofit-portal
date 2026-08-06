import logo from '../../assets/logo.png';

export default function AuthLayout({ image, children }) {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <div
        className="hidden lg:block bg-cover bg-center"
        style={{ backgroundImage: `url(${image})` }}
      />
      <div className="flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-1 text-2xl font-semibold text-ink mb-10">
            <img src={logo} alt="Retrofit Portal" className="w-7 shrink-0" />
            <span>
              RETROFIT
              <div className="text-[11px] tracking-[0.3em] font-medium text-body -mt-1">
                PORTAL
              </div>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
