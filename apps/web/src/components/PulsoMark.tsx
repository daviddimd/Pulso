import "./PulsoMark.css";

type PulsoMarkProps = {
  size?: "small" | "medium" | "large";
};

export function PulsoMark({
  size = "medium",
}: PulsoMarkProps) {
  return (
    <span
      className={`pulso-mark pulso-mark--${size}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polyline
          points="
            5,25
            13,25
            16,22
            19,25
            22,25
            25,33
            29,14
            33,29
            36,25
            43,25
          "
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}