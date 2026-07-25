// The "Drive Thru" wordmark lockup. Two PNGs — one tuned for light
// backgrounds, one for dark — are both rendered and swapped by CSS off the
// [data-theme] attribute so the logo stays legible in either theme.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={`logo${className ? ` ${className}` : ''}`}>
      <img className="logo-light" src="/lockup-on-light.png" alt="Drive Thru" />
      <img className="logo-dark" src="/lockup-on-dark.png" alt="Drive Thru" aria-hidden="true" />
    </span>
  );
}
