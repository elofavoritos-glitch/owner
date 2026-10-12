// Logo da ELO em SVG (símbolo circular com "swoosh"), reproduzido a partir da
// marca. Vetorial: nítido em qualquer tela. Troque por um arquivo oficial depois
// colocando-o em /public e usando <img> se preferir o logo exato.
export default function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-label="ELO" role="img">
      <defs>
        <linearGradient id="eloGradClaro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7FC4F0" />
          <stop offset="1" stopColor="#BFE2F7" />
        </linearGradient>
        <linearGradient id="eloGradEscuro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1F3864" />
          <stop offset="1" stopColor="#2E75B6" />
        </linearGradient>
      </defs>
      {/* disco base claro */}
      <circle cx="50" cy="50" r="46" fill="url(#eloGradClaro)" />
      {/* swoosh escuro (meia-lua em "e") */}
      <path
        d="M50 6
           a44 44 0 1 0 24 80
           a34 34 0 1 1 -18 -70
           a44 44 0 0 0 -6 -10 z"
        fill="url(#eloGradEscuro)"
        opacity="0.95"
      />
      {/* brilho sutil */}
      <circle cx="36" cy="32" r="10" fill="#FFFFFF" opacity="0.22" />
    </svg>
  );
}
