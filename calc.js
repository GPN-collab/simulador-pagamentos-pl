/**
 * Funções puras de cálculo do simulador de pagamentos Prima Linea.
 * Extraídas do index.html para permitir testes unitários isolados.
 */

const DEFAULTS = {
  fatorCorrecao: 0.1665,
  santander: [
    1.0253, 0.5190540118, 0.350340458, 0.2660100047, 0.2154327824,
    0.1817321657, 0.1567768837, 0.1387546517, 0.1247476901,
    0.1135514091, 0.1043992506, 0.09678017505,
    0.0900, 0.0840, 0.0787, 0.0741, 0.0700, 0.0663
  ],
  santander60: [
    1.05124, 0.53219, 0.3592, 0.27274, 0.22088,
    0.18633, 0.16051, 0.14206, 0.12772,
    0.11625, 0.10688, 0.09908,
    0.0921, 0.0859, 0.0805, 0.0757, 0.0714, 0.0676
  ],
  boleto: [0.20, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06],
  cartao: [0.16, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03],
};

// ── Formatadores ─────────────────────────────────────────────────────────────

function fmt(v) {
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function fmtData(d) {
  if (!d) return null;
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('/');
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ── Datas de parcelas ─────────────────────────────────────────────────────────

function getDates(dE, dP, parcelas, semEntrada) {
  return parcelas.map((p, i) => {
    if (i === 0 && !semEntrada && p.label === 'Entrada') return dE ? fmtData(dE) : null;
    const idx = !semEntrada && p.label !== 'Entrada' ? i - 1 : i;
    return dP ? fmtData(addMonths(dP, idx)) : null;
  });
}

// ── Cálculos de parcelas ──────────────────────────────────────────────────────

function parcelas_boleto(valor, n, semEntrada, cfgBoleto) {
  const descs = {};
  cfgBoleto.forEach((v, i) => (descs[i + 1] = v));
  const total = valor * (1 - descs[n]);
  const p = total / n;
  const result = [];
  if (n === 1) result.push({ label: 'Pagamento único', valor: total });
  else if (semEntrada) for (let i = 1; i <= n; i++) result.push({ label: `Parcela ${i}`, valor: p });
  else {
    result.push({ label: 'Entrada', valor: p });
    for (let i = 2; i <= n; i++) result.push({ label: `Parcela ${i}`, valor: p });
  }
  return { parcelas: result, total, desc: descs[n] };
}

function parcelas_santander(valor, n, semEntrada, fatores, fatorCorrecao) {
  const F = fatores;
  const fc = fatorCorrecao;
  const O1 = valor * (1 - fc);
  const result = [];
  let total;
  if (semEntrada) {
    const pm = O1 * F[n];
    total = pm * n;
    for (let i = 1; i <= n; i++) result.push({ label: `Parcela ${i}`, valor: pm });
  } else {
    const pm = (O1 - O1 / n) * F[n - 1];
    total = pm * n;
    result.push({ label: 'Entrada', valor: pm });
    for (let i = 2; i <= n; i++) result.push({ label: `Parcela ${i}`, valor: pm });
  }
  return { parcelas: result, total };
}

function parcelas_cartao(valor, desc, n) {
  const total = valor * (1 - desc);
  const p = total / n;
  const result = [];
  if (n === 1) result.push({ label: 'Pagamento único', valor: total });
  else for (let i = 1; i <= n; i++) result.push({ label: `Parcela ${i}`, valor: p });
  return { parcelas: result, total, desc };
}

// ── Lógica de data da 1ª parcela por modo ────────────────────────────────────
// Espelha o comportamento de syncEntradaVisibility no index.html.

function getDataParcelaParaModo(modo, hoje) {
  const d = new Date(hoje);
  d.setHours(0, 0, 0, 0);
  if (modo === 'sem60') {
    d.setDate(d.getDate() + 60);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

// ── Validação da data de entrada ──────────────────────────────────────────────

function maxDataEntrada(hoje) {
  const d = new Date(hoje);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 6);
  return d;
}

function isDataEntradaValida(dataEntrada, hoje) {
  const max = maxDataEntrada(hoje);
  const d = new Date(dataEntrada);
  d.setHours(0, 0, 0, 0);
  return d <= max;
}

module.exports = {
  DEFAULTS,
  fmt,
  fmtData,
  addMonths,
  getDates,
  parcelas_boleto,
  parcelas_santander,
  parcelas_cartao,
  getDataParcelaParaModo,
  maxDataEntrada,
  isDataEntradaValida,
};
