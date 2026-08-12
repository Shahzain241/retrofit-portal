import '../styles/Button.css';

/**
 * Shared Button component — renders every primary/secondary/ghost action
 * across the portal. Styling lives in styles/Button.css.
 *
 * Variants:
 *   primary | green | outline | navy | ghost | gradient | gradientEdge
 *
 * Fixed pixel sizes come from each page's stylesheet via the `className`
 * prop (e.g. `.rp-button.rp-new-project`), so the Button itself stays dumb.
 */
const variantClass = {
  primary: 'rp-button-primary',
  green: 'rp-button-green',
  outline: 'rp-button-outline',
  navy: 'rp-button-navy',
  ghost: 'rp-button-ghost',
  gradient: 'rp-button-gradient',
  gradientEdge: 'rp-button-gradientEdge',
};

export default function Button({
  variant = 'primary',
  className = '',
  children,
  icon: Icon,
  ...props
}) {
  return (
    <button className={`rp-button ${variantClass[variant] || ''} ${className}`} {...props}>
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}