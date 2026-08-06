const variants = {
  primary: 'bg-gradient-to-r from-navy-900 to-teal-700 text-white hover:opacity-90',
  green: 'bg-brand-green text-white hover:opacity-90',
  outline: 'bg-white text-ink border border-line hover:bg-surface',
  navy: 'bg-navy-900 text-white hover:bg-navy-800',
  ghost: 'bg-transparent text-body hover:bg-surface',
};

export default function Button({
  variant = 'primary',
  className = '',
  children,
  icon: Icon,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
