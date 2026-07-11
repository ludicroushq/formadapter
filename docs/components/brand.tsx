export function Brand(): React.JSX.Element {
  return (
    <span className="fa-brand">
      <svg
        aria-hidden="true"
        className="fa-brand-mark"
        fill="none"
        viewBox="0 0 32 32"
      >
        <rect fill="currentColor" height="32" rx="8" width="32" />
        <path
          d="M9 11.5h5.5M9 16h9.5M9 20.5h5.5M23 11.5v9"
          stroke="white"
          strokeLinecap="round"
          strokeWidth="2"
        />
        <circle cx="23" cy="11.5" fill="white" r="2" />
        <circle cx="23" cy="20.5" fill="white" r="2" />
      </svg>
      <span className="fa-brand-name">FormAdapter</span>
    </span>
  );
}
