// Compõe o SYSTEM_PROMPT do assistente a partir dos módulos de prompt.
// A ordem e os separadores reproduzem exatamente o prompt original
// (bloco comercial, bloco Senior ERP e a linha de identificação da empresa).
import { EMPRESA } from "../elo-intelligence";
import { COMERCIAL_PROMPT } from "./comercial";
import { SENIOR_ERP_PROMPT } from "./senior-erp";

export const SYSTEM_PROMPT = `${COMERCIAL_PROMPT}

${SENIOR_ERP_PROMPT}

Empresa: ${EMPRESA.nome} — ${EMPRESA.posicionamento} (${EMPRESA.cidade}).`;
