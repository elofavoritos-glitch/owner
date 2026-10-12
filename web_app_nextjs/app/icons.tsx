// Ícones SVG (stroke) — leves, nítidos e profissionais. Substituem os emojis,
// que não renderizam de forma consistente em todos os ambientes.
type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
});

export const IconClientes = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6" /><path d="M9 9h.01M15 9h.01" /></svg>
);
export const IconInteracoes = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
export const IconPropostas = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8M8 17h5" /></svg>
);
export const IconAssistente = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4M8 21h8" /></svg>
);
export const IconAjuda = ({ size = 16 }: P) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
);
export const IconMic = ({ size = 18 }: P) => (
  <svg {...base(size)}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4M8 21h8" /></svg>
);
export const IconStop = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
export const IconSom = ({ size = 15 }: P) => (
  <svg {...base(size)}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
);
export const IconSomOff = ({ size = 15 }: P) => (
  <svg {...base(size)}><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
);
export const IconEnviar = ({ size = 16 }: P) => (
  <svg {...base(size)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></svg>
);
export const IconUpload = ({ size = 15 }: P) => (
  <svg {...base(size)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
);
export const IconVoltar = ({ size = 15 }: P) => (
  <svg {...base(size)}><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
);
