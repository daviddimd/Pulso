import { PulsoMark } from "./PulsoMark";

const pulse = [
  "M0 125H190C210 125 218 101 232 101C246 101 254 125 272 125H310",
  "L334 158L369 48L402 145L424 125H470",
  "C490 125 499 94 518 94C537 94 545 125 568 125H900",
].join("");

export function LoginVisual({ caption }: { caption: string }) {
  return (
    <section className="login-visual" aria-label="Oficina de Movilización">
      <svg className="login-pulse" viewBox="0 0 900 240" aria-hidden="true">
        <path
          d={pulse}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="login-institution">
        <PulsoMark size="small" />
        <div>
          <strong>Oficina de Movilización</strong>
          <span>{caption}</span>
        </div>
      </div>
    </section>
  );
}
