/**
 * Monta as condições de pagamento exibidas no simulador (cards agrupados por
 * seção) a partir do valor, da modalidade, das datas e da configuração.
 * Sem acesso ao DOM — o desenho dos cards fica em js/simulador.js.
 *
 * Funciona no navegador (expõe `window.PLSimulacao`) e no Node (via `require`).
 */
(function (root, factory) {
  const calc = typeof module === 'object' && module.exports ? require('./calc') : root.PLCalc;
  const api = factory(calc);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PLSimulacao = api;
})(globalThis, function (calc) {
  'use strict';

  const { formatarPercentual } = calc;

  // Cada modalidade define se há entrada e quais fatores / opções do Santander usar.
  const MODOS = {
    com:   { comEntrada: true,  fatores: 'santander',   habilitados: 'santanderCom' },
    sem30: { comEntrada: false, fatores: 'santander',   habilitados: 'santander30' },
    sem60: { comEntrada: false, fatores: 'santander60', habilitados: 'santander60' },
  };

  const ROTULOS_CARTAO = ['Débito', 'Crédito à vista'];

  /**
   * Cards a exibir, agrupados por seção.
   * @param {number} valor   valor do orçamento
   * @param {string} modo    'com' | 'sem30' | 'sem60'
   * @param {{dataEntrada: Date|null, dataPrimeiraParcela: Date|null}} datas
   * @param {object} config  configuração normalizada (PLConfig.normalizar)
   */
  function montarSecoes(valor, modo, datas, config) {
    const { comEntrada, fatores, habilitados } = MODOS[modo];
    const hab = config.habilitados;
    const opcoes = (quantidade, chave) => Array.from({ length: quantidade }, (_, i) => i).filter(i => hab[chave][i]);

    const card = (tema, titulo, desconto, resultado) => ({
      tema,
      titulo,
      selo: `↓ ${desconto}% desconto`,
      total: resultado.total,
      parcelas: resultado.parcelas,
      resumo: calc.resumirParcelas(resultado.parcelas),
      datas: calc.calcularDatas(resultado.parcelas, { ...datas, comEntrada }),
    });

    // Boleto e cartão só existem na modalidade com entrada.
    const boleto = !comEntrada ? [] : opcoes(config.boleto.length, 'boleto').map(i => {
      const n = i + 1;
      const desconto = config.boleto[i];
      return card('boleto', n === 1 ? 'À vista' : `1+${n - 1} Boleto`, formatarPercentual(desconto, 0),
        calc.calcularBoleto(valor, n, desconto, true));
    });

    const santander = opcoes(config[fatores].length, habilitados).map(i => {
      const n = i + 1;
      const resultado = calc.calcularSantander(valor, n, {
        fatores: config[fatores],
        fatorCorrecao: config.fatorCorrecao,
        comEntrada,
      });
      return card('santander', comEntrada ? `1+${n - 1} Santander` : `${n}× Santander`,
        formatarPercentual(1 - resultado.total / valor, 1), resultado);
    });

    // Cartão: índice 0 = débito, 1 = crédito à vista, i ≥ 2 = i× crédito
    const cartao = !comEntrada ? [] : opcoes(config.cartao.length, 'cartao').map(i => {
      const n = Math.max(i, 1);
      const desconto = config.cartao[i];
      return card('cartao', ROTULOS_CARTAO[i] ?? `${n}× Crédito`, formatarPercentual(desconto, 0),
        calc.calcularCartao(valor, n, desconto));
    });

    return [
      { tema: 'boleto',    titulo: 'Boleto · Cheque · Dinheiro', cards: boleto },
      { tema: 'santander', titulo: 'Financiamento Santander',    cards: santander },
      { tema: 'cartao',    titulo: 'Cartão Visa · Mastercard',   cards: cartao },
    ].filter(secao => secao.cards.length);
  }

  return { MODOS, montarSecoes };
});
