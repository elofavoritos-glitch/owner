/* Dashboard comercial ELO — sem dependências externas.
   Carrega data.json, calcula indicadores e desenha gráficos em SVG. */

const CORES = {
  azul: "#1F3864", azul2: "#2E75B6", verde: "#70AD47",
  amarelo: "#FFC000", vermelho: "#C0392B", cinza: "#607D8B",
};
const ETAPAS = ["Prospecção", "Qualificação", "Diagnóstico", "Cotação", "Negociação", "Ganho", "Perdido"];

let DADOS = null;
let filtroVendedor = "";

function moeda(v) {
  return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function el(id) { return document.getElementById(id); }

async function carregar() {
  // 1) Tenta data.json (servidor local / produção). 2) Cai para dados embutidos (file://).
  try {
    const resp = await fetch("data.json", { cache: "no-store" });
    if (resp.ok) DADOS = await resp.json();
  } catch (e) { /* fetch bloqueado em file:// — usa fallback */ }
  if (!DADOS && window.ELO_DADOS) DADOS = window.ELO_DADOS;
  if (!DADOS) {
    document.body.innerHTML = "<p style='padding:24px'>Não foi possível carregar os dados. "
      + "Gere com <code>python3 gerar_dados.py</code>.</p>";
    return;
  }
  montarFiltro();
  render();
}

function oportunidadesFiltradas() {
  const ops = DADOS.oportunidades || [];
  return filtroVendedor ? ops.filter(o => o.responsavel === filtroVendedor) : ops;
}

function montarFiltro() {
  const sel = el("filtro-vendedor");
  const nomes = [...new Set((DADOS.oportunidades || []).map(o => o.responsavel).filter(Boolean))].sort();
  nomes.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n; sel.appendChild(opt);
  });
  sel.addEventListener("change", e => { filtroVendedor = e.target.value; render(); });
  el("btn-pdf").addEventListener("click", () => window.print());
}

/* ---------- cálculos sobre o conjunto filtrado ---------- */
function resumo(ops) {
  let potencial = 0, ponderado = 0, ganhas = 0, perdidas = 0, abertas = 0, risco = 0;
  const hoje = new Date(DADOS.gerado_em);
  for (const o of ops) {
    const pot = Number(o.valor_potencial || 0);
    const prob = Number(o.probabilidade || 0);
    potencial += pot; ponderado += pot * prob;
    const etapa = o.etapa || "";
    if (etapa === "Ganho" || (o.status || "").toLowerCase() === "ganha") ganhas++;
    else if (etapa === "Perdido" || (o.status || "").toLowerCase() === "perdida") perdidas++;
    else {
      abertas++;
      const semAcao = !(o.proxima_acao || "").trim();
      const dp = o.data_proxima_acao ? new Date(o.data_proxima_acao) : null;
      if (semAcao || (dp && dp < hoje)) risco++;
    }
  }
  const conv = (ganhas + perdidas) ? Math.round(ganhas / (ganhas + perdidas) * 100) : null;
  return { potencial, ponderado, ganhas, perdidas, abertas, risco, conv, total: ops.length };
}

function porEtapa(ops) {
  const m = {};
  ETAPAS.forEach(e => m[e] = { q: 0, pot: 0, pond: 0 });
  ops.forEach(o => {
    const e = o.etapa; if (!m[e]) return;
    m[e].q++; const pot = Number(o.valor_potencial || 0);
    m[e].pot += pot; m[e].pond += pot * Number(o.probabilidade || 0);
  });
  return m;
}

/* ---------- render ---------- */
function render() {
  const ops = oportunidadesFiltradas();
  const r = resumo(ops);
  renderKpis(r);
  renderFunil(porEtapa(ops));
  renderPonderado(porEtapa(ops));
  renderConversao(r);
  renderMetas();
  renderEvolucao();
  renderProdutividade();
  renderRisco(ops);
  renderRanking();
  renderOportunidades(ops);
  el("rodape-info").textContent =
    `Gerado em ${DADOS.gerado_em} · ${DADOS.empresa}` + (filtroVendedor ? ` · filtro: ${filtroVendedor}` : "");
}

function renderKpis(r) {
  const cards = [
    { v: moeda(r.potencial), l: "Pipeline potencial" },
    { v: moeda(r.ponderado), l: "Previsão ponderada", cls: "ok" },
    { v: r.abertas, l: "Oportunidades abertas" },
    { v: r.conv === null ? "—" : r.conv + "%", l: "Taxa de conversão" },
    { v: r.risco, l: "Em risco", cls: r.risco ? "alerta" : "" },
  ];
  el("kpis").innerHTML = cards.map(c =>
    `<div class="kpi ${c.cls || ""}"><div class="valor">${c.v}</div><div class="rotulo">${c.l}</div></div>`
  ).join("");
}

/* Barras horizontais genéricas */
function barrasHorizontais(dados, { cor = CORES.azul2, formato = (v) => v } = {}) {
  const max = Math.max(1, ...dados.map(d => d.valor));
  const linha = 30, gap = 10, largura = 560, labelW = 120, barW = largura - labelW - 70;
  const altura = dados.length * (linha + gap) + 10;
  let svg = `<svg viewBox="0 0 ${largura} ${altura}" width="100%" role="img">`;
  dados.forEach((d, i) => {
    const y = i * (linha + gap) + 8;
    const w = Math.round(d.valor / max * barW);
    svg += `<text class="bar-label" x="0" y="${y + 19}">${d.rotulo}</text>`;
    svg += `<rect x="${labelW}" y="${y}" width="${Math.max(2, w)}" height="${linha}" rx="5" fill="${d.cor || cor}"/>`;
    svg += `<text class="bar-value" x="${labelW + Math.max(2, w) + 6}" y="${y + 19}">${formato(d.valor)}</text>`;
  });
  return svg + "</svg>";
}

function renderFunil(m) {
  const dados = ETAPAS.filter(e => !["Ganho", "Perdido"].includes(e))
    .map(e => ({ rotulo: e, valor: m[e].q, cor: CORES.azul2 }));
  el("chart-funil").innerHTML = barrasHorizontais(dados, { formato: v => v + " op." });
}

function renderPonderado(m) {
  const dados = ETAPAS.filter(e => e !== "Perdido")
    .map(e => ({ rotulo: e, valor: Math.round(m[e].pond), cor: e === "Ganho" ? CORES.verde : CORES.azul }));
  el("chart-ponderado").innerHTML = barrasHorizontais(dados, { formato: moeda });
}

function renderConversao(r) {
  const total = r.ganhas + r.perdidas;
  if (!total) { el("chart-conversao").innerHTML = "<p style='color:#607D8B'>Sem oportunidades fechadas.</p>"; return; }
  const frac = r.ganhas / total;
  const raio = 70, c = 2 * Math.PI * raio, cx = 100, cy = 100;
  const ganhasLen = c * frac;
  el("chart-conversao").innerHTML = `
    <svg viewBox="0 0 200 200" width="220" height="220" role="img">
      <circle cx="${cx}" cy="${cy}" r="${raio}" fill="none" stroke="${CORES.vermelho}" stroke-width="26"/>
      <circle cx="${cx}" cy="${cy}" r="${raio}" fill="none" stroke="${CORES.verde}" stroke-width="26"
        stroke-dasharray="${ganhasLen} ${c - ganhasLen}" stroke-dashoffset="${c / 4}" transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="30" font-weight="800" fill="${CORES.azul}">${Math.round(frac * 100)}%</text>
      <text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="12" fill="${CORES.cinza}">conversão</text>
    </svg>
    <div style="margin-left:16px;align-self:center">
      <div><span class="tag ganha">Ganhas</span> ${r.ganhas}</div>
      <div style="margin-top:8px"><span class="tag perdida">Perdidas</span> ${r.perdidas}</div>
    </div>`;
}

function renderMetas() {
  const linhas = (DADOS.metas && DADOS.metas.ranking) || [];
  const dados = linhas.filter(l => l.atingimento_percent !== null).map(l => ({
    rotulo: l.responsavel, valor: Math.round(l.atingimento_percent),
    cor: l.atingimento_percent >= 100 ? CORES.verde : (l.atingimento_percent >= 60 ? CORES.amarelo : CORES.vermelho),
  }));
  if (!dados.length) { el("chart-metas").innerHTML = "<p style='color:#607D8B'>Sem metas cadastradas.</p>"; return; }
  el("chart-metas").innerHTML = barrasHorizontais(dados, { formato: v => v + "%" });
}

function renderEvolucao() {
  const serie = DADOS.evolucao_mensal || [];
  if (!serie.length) { el("chart-evolucao").innerHTML = "<p style='color:#607D8B'>Sem série mensal.</p>"; return; }
  const W = 760, H = 260, padL = 60, padB = 30, padT = 10, padR = 10;
  const max = Math.max(...serie.map(s => Math.max(s.proposto, s.ganho))) * 1.1;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const x = i => padL + (serie.length === 1 ? innerW / 2 : i * innerW / (serie.length - 1));
  const y = v => padT + innerH - (v / max) * innerH;
  const linha = (campo, cor) => serie.map((s, i) => `${i ? "L" : "M"}${x(i)},${y(s[campo])}`).join(" ");
  const pontos = (campo, cor) => serie.map((s, i) => `<circle cx="${x(i)}" cy="${y(s[campo])}" r="3.5" fill="${cor}"/>`).join("");
  let grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = padT + innerH - (g / 4) * innerH;
    const val = Math.round(max * g / 4 / 1000);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}" stroke="#EEF2F7"/>`
      + `<text x="0" y="${gy + 4}" class="bar-value">${val}k</text>`;
  }
  const rotulos = serie.map((s, i) => `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="bar-value">${s.mes}</text>`).join("");
  el("chart-evolucao").innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img">
      ${grid}
      <path d="${linha("proposto")}" fill="none" stroke="${CORES.azul2}" stroke-width="2.5"/>
      <path d="${linha("ganho")}" fill="none" stroke="${CORES.verde}" stroke-width="2.5"/>
      ${pontos("proposto", CORES.azul2)}${pontos("ganho", CORES.verde)}
      ${rotulos}
    </svg>
    <div style="display:flex;gap:18px;margin-top:8px;font-size:13px">
      <span><span style="display:inline-block;width:12px;height:12px;background:${CORES.azul2};border-radius:2px"></span> Proposto</span>
      <span><span style="display:inline-block;width:12px;height:12px;background:${CORES.verde};border-radius:2px"></span> Ganho</span>
    </div>`;
}

function renderProdutividade() {
  const prod = DADOS.produtividade || [];
  if (!prod.length) { el("tabela-produtividade").innerHTML = "<p style='color:#607D8B'>Sem dados de produtividade.</p>"; return; }
  el("tabela-produtividade").innerHTML = tabela(
    ["Vendedor", "Ligações", "Reuniões", "Propostas", "Ganhos", "Conversão prop.→ganho"],
    prod.map(p => {
      const conv = p.propostas ? Math.round(p.ganhos / p.propostas * 100) : 0;
      return [p.responsavel, p.ligacoes, p.reunioes, p.propostas, p.ganhos, conv + "%"];
    })
  );
}

function renderRisco(ops) {
  const hoje = new Date(DADOS.gerado_em);
  const risco = ops.filter(o => {
    const etapa = o.etapa || "";
    if (["Ganho", "Perdido"].includes(etapa)) return false;
    const semAcao = !(o.proxima_acao || "").trim();
    const dp = o.data_proxima_acao ? new Date(o.data_proxima_acao) : null;
    return semAcao || (dp && dp < hoje);
  }).sort((a, b) => Number(b.valor_potencial) - Number(a.valor_potencial));
  if (!risco.length) { el("tabela-risco").innerHTML = "<p style='color:#70AD47'>Nenhuma oportunidade em risco. 👍</p>"; return; }
  el("tabela-risco").innerHTML = tabela(
    ["Cliente", "Resp.", "Etapa", "Motivo", "Potencial"],
    risco.map(o => {
      const semAcao = !(o.proxima_acao || "").trim();
      return [o.cliente, o.responsavel, o.etapa,
        `<span class="tag alta">${semAcao ? "sem próxima ação" : "ação atrasada"}</span>`,
        moeda(o.valor_potencial)];
    })
  );
}

function renderRanking() {
  const linhas = (DADOS.metas && DADOS.metas.ranking) || [];
  el("tabela-ranking").innerHTML = tabela(
    ["#", "Vendedor", "Realizado", "Meta", "Atingim.", "Situação"],
    linhas.map(l => [l.posicao, l.responsavel, moeda(l.realizado),
      l.meta === null ? "—" : moeda(l.meta),
      l.atingimento_percent === null ? "—" : l.atingimento_percent + "%", l.situacao])
  );
}

function renderOportunidades(ops) {
  const prio = { "Negociação": "alta", "Cotação": "media", "Diagnóstico": "media" };
  el("tabela-oportunidades").innerHTML = tabela(
    ["ID", "Cliente", "Resp.", "Etapa", "Status", "Potencial", "Prob.", "Ponderado"],
    ops.map(o => {
      const pond = Number(o.valor_potencial || 0) * Number(o.probabilidade || 0);
      const st = (o.status || "").toLowerCase();
      const stTag = st === "ganha" ? `<span class="tag ganha">Ganha</span>` :
        st === "perdida" ? `<span class="tag perdida">Perdida</span>` :
        `<span class="tag ${prio[o.etapa] || "baixa"}">${o.status || "Ativa"}</span>`;
      return [o.id, o.cliente, o.responsavel, o.etapa, stTag, moeda(o.valor_potencial),
        Math.round(Number(o.probabilidade || 0) * 100) + "%", moeda(pond)];
    })
  );
}

function tabela(cabecalhos, linhas) {
  const th = cabecalhos.map(c => `<th>${c}</th>`).join("");
  const tr = linhas.map(l => "<tr>" + l.map(c => `<td>${c}</td>`).join("") + "</tr>").join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

carregar();
