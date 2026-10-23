/**
 * Regras de negócio do simulador Prima Linea: cálculo das parcelas, datas,
 * formatação e validação. Funções puras, sem acesso ao DOM, cobertas por
 * tests/calc.test.js.
 *
 * Funciona no navegador (expõe `window.PLCalc`) e no Node (via `require`).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PLCalc = api;
})(globalThis, function () {
  'use strict';

  const PAGAMENTO_UNICO = 'Pagamento único';
  const DIAS_MAX_ENTRADA = 6;

  // ── Formatação ─────────────────────────────────────────────────────────────

  /** 1234.5 → "1.234,50" */
  function formatarNumero(v) {
    return v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** 1234.5 → "R$ 1.234,50" */
  function formatarMoeda(v) {
    return 'R$ ' + formatarNumero(v);
  }

  /** "1.234,50" → 1234.5 (NaN se vazio) */
  function parseMoeda(texto) {
    return parseFloat(texto.replace(/\./g, '').replace(',', '.'));
  }

  /** 0.104 → "10,4" */
  function formatarPercentual(fracao, casas) {
    return (fracao * 100).toFixed(casas).replace('.', ',');
  }

  const doisDigitos = n => String(n).padStart(2, '0');

  /** Date → "dd/mm/aaaa" (null se não houver data) */
  function formatarData(d) {
    if (!d) return null;
    return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** Date → "aaaa-mm-dd" (formato do <input type="date">) */
  function formatarDataISO(d) {
    return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
  }

  /** "dd/mm/aaaa" → Date ao meio-dia (evita problemas de fuso), ou null se inválida */
  function parseDataBR(texto) {
    const [d, m, a] = (texto || '').split('/');
    if (d?.length !== 2 || m?.length !== 2 || a?.length !== 4) return null;
    const data = new Date(`${a}-${m}-${d}T12:00:00`);
    return isNaN(data) ? null : data;
  }

  /** "aaaa-mm-dd" → "dd/mm/aaaa" */
  function isoParaBR(iso) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }

  /** Aplica a máscara dd/mm/aaaa a um texto digitado */
  function mascararData(texto) {
    const digitos = texto.replace(/\D/g, '').slice(0, 8);
    return [digitos.slice(0, 2), digitos.slice(2, 4), digitos.slice(4)].filter(Boolean).join('/');
  }

  /** Aplica a máscara monetária: dígitos digitados viram centavos ("123456" → "1.234,56") */
  function mascararMoeda(texto) {
    const digitos = texto.replace(/\D/g, '');
    return digitos ? formatarNumero(parseInt(digitos, 10) / 100) : '';
  }

  // ── Datas ──────────────────────────────────────────────────────────────────

  function somarMeses(data, n) {
    const d = new Date(data);
    d.setMonth(d.getMonth() + n);
    return d;
  }

  function somarDias(data, n) {
    const d = new Date(data);
    d.setDate(d.getDate() + n);
    return d;
  }

  function inicioDoDia(data) {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Última data aceita para a entrada: hoje + 6 dias. */
  function maxDataEntrada(hoje) {
    return somarDias(inicioDoDia(hoje), DIAS_MAX_ENTRADA);
  }

  function isDataEntradaValida(dataEntrada, hoje) {
    return inicioDoDia(dataEntrada) <= maxDataEntrada(hoje);
  }

  /** Data sugerida para a 1ª parcela: daqui a 60 dias no modo "sem60", senão daqui a um mês. */
  function dataPrimeiraParcelaPadrao(modo, hoje) {
    const d = inicioDoDia(hoje);
    return modo === 'sem60' ? somarDias(d, 60) : somarMeses(d, 1);
  }

  /**
   * Data de cada parcela, no formato dd/mm/aaaa.
   *  - A entrada (e o pagamento único) cai na data da entrada.
   *  - Sem entrada, a parcela i cai em (1ª parcela + i meses).
   *  - Com entrada, a parcela i cai em (1ª parcela + i − 1 meses). Como a entrada
   *    ocupa a posição 0, as mensais começam exatamente na data da 1ª parcela.
   *    No cartão parcelado (sem parcela de entrada) isso faz a 1ª cobrança cair
   *    um mês antes da 1ª parcela — ou seja, no mês da compra.
   */
  function calcularDatas(parcelas, { dataEntrada, dataPrimeiraParcela, comEntrada }) {
    return parcelas.map((p, i) => {
      if (p.entrada) return formatarData(dataEntrada);
      return dataPrimeiraParcela ? formatarData(somarMeses(dataPrimeiraParcela, comEntrada ? i - 1 : i)) : null;
    });
  }

  // ── Validação ──────────────────────────────────────────────────────────────

  /**
   * Valida as datas informadas. Devolve a mensagem de erro de cada campo
   * (ou null quando o campo está ok).
   */
  function validarDatas({ dataEntrada, dataPrimeiraParcela, comEntrada, hoje }) {
    let entrada = null;
    if (comEntrada && !dataEntrada) entrada = 'Campo obrigatório';
    else if (comEntrada && !isDataEntradaValida(dataEntrada, hoje)) entrada = `Data máxima: hoje + ${DIAS_MAX_ENTRADA} dias`;

    let parcela = null;
    if (!dataPrimeiraParcela) parcela = 'Campo obrigatório';
    else if (comEntrada && dataEntrada && dataPrimeiraParcela <= dataEntrada) parcela = 'Deve ser após a data da entrada';

    return { entrada, parcela };
  }

  // ── Parcelas ───────────────────────────────────────────────────────────────

  /** n parcelas de mesmo valor; com entrada, a primeira é a entrada. */
  function dividir(valorParcela, n, comEntrada) {
    return Array.from({ length: n }, (_, i) =>
      comEntrada && i === 0
        ? { label: 'Entrada', valor: valorParcela, entrada: true }
        : { label: `Parcela ${i + 1}`, valor: valorParcela }
    );
  }

  /** À vista ou parcelado em valores iguais, com desconto sobre o total. */
  function parcelarComDesconto(valor, n, desconto, comEntrada) {
    const total = valor * (1 - desconto);
    const parcelas = n === 1
      ? [{ label: PAGAMENTO_UNICO, valor: total, entrada: true }]
      : dividir(total / n, n, comEntrada);
    return { total, desconto, parcelas };
  }

  /** Boleto / cheque / dinheiro: desconto sobre o valor, dividido em n parcelas iguais. */
  function calcularBoleto(valor, n, desconto, comEntrada) {
    return parcelarComDesconto(valor, n, desconto, comEntrada);
  }

  /** Cartão Visa / Mastercard: desconto sobre o valor, dividido em n parcelas iguais. */
  function calcularCartao(valor, n, desconto) {
    return parcelarComDesconto(valor, n, desconto, false);
  }

  /**
   * Financiamento Santander, com `fatores` indexados a partir de 1 parcela (índice 0).
   *   base = valor × (1 − fatorCorrecao)
   *   Com entrada: entrada = parcela = (base − base/n) × fatores[n−2]
   *                (só as n−1 parcelas restantes passam pelo Santander)
   *   Sem entrada: parcela = base × fatores[n−1]
   */
  function calcularSantander(valor, n, { fatores, fatorCorrecao, comEntrada }) {
    const base = valor * (1 - fatorCorrecao);
    const parcela = comEntrada ? (base - base / n) * fatores[n - 2] : base * fatores[n - 1];
    return { total: parcela * n, parcelas: dividir(parcela, n, comEntrada) };
  }

  /**
   * Resumo do card ("Entrada R$ X", "5× de R$ Y"...). Cada linha tem um
   * texto e um trecho em destaque.
   */
  function resumirParcelas(parcelas) {
    const [primeira, segunda] = parcelas;
    if (primeira.label === PAGAMENTO_UNICO) return [{ texto: PAGAMENTO_UNICO, destaque: '' }];
    if (primeira.entrada) {
      return [
        { texto: 'Entrada ', destaque: formatarMoeda(primeira.valor) },
        { texto: `${parcelas.length - 1}× de `, destaque: formatarMoeda(segunda?.valor ?? 0) },
      ];
    }
    return [{ texto: '', destaque: `${parcelas.length}× de ${formatarMoeda(primeira.valor)}` }];
  }

  return {
    formatarNumero,
    formatarMoeda,
    formatarPercentual,
    parseMoeda,
    formatarData,
    formatarDataISO,
    parseDataBR,
    isoParaBR,
    mascararData,
    mascararMoeda,
    somarMeses,
    somarDias,
    maxDataEntrada,
    isDataEntradaValida,
    dataPrimeiraParcelaPadrao,
    calcularDatas,
    validarDatas,
    calcularBoleto,
    calcularCartao,
    calcularSantander,
    resumirParcelas,
  };
});
