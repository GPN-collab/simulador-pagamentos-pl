/**
 * Equivalência entre a versão anterior do simulador (tests/legado) e a atual
 * (js/). Os mesmos cenários rodam nas duas e os resultados têm de ser
 * idênticos: mesmos cards, títulos, selos, totais, parcelas (centavo a
 * centavo, sem tolerância), datas, resumos, mensagens de erro e máscaras.
 */
const legado = require('./legado/simulador-legado');
const calc = require('../js/calc');
const { normalizar } = require('../js/config');
const { MODOS, montarSecoes } = require('../js/simulacao');

// ── A versão atual, exposta com a mesma interface do atualizar() antigo ──────

function atualizarNovo({ valorTexto, dataEntradaTexto, dataParcelaTexto, modo, cfg, agora }) {
  const valor = calc.parseMoeda(valorTexto);
  const datas = {
    dataEntrada: calc.parseDataBR(dataEntradaTexto),
    dataPrimeiraParcela: calc.parseDataBR(dataParcelaTexto),
  };
  if (!(valor > 0)) return { placeholder: true };
  const erros = calc.validarDatas({ ...datas, comEntrada: MODOS[modo].comEntrada, hoje: agora });
  if (erros.entrada || erros.parcela) return { erros };
  return { secoes: montarSecoes(valor, modo, datas, normalizar(cfg)) };
}

// Converte um card novo para o formato do card antigo (o antigo `data-payload`).
const CLASSE_DO_TEMA = { boleto: 'badge-desc', santander: 'badge-santan', cartao: 'badge-cartao' };

function noFormatoAntigo(card) {
  return {
    label: card.titulo,
    badge: card.selo,
    badgeClass: CLASSE_DO_TEMA[card.tema],
    totalVal: card.total,
    lines: card.resumo.map(l => (l.destaque ? `${l.texto}<strong>${l.destaque}</strong>` : l.texto)),
    parcelas: card.parcelas.map(({ label, valor }) => ({ label, valor })),
    total: card.total,
    dates: card.datas,
  };
}

/** Resultado da tela, nas duas versões, num formato comparável. */
function comparavel(resultado, converter) {
  if (!resultado.secoes) return resultado;
  return Object.fromEntries(resultado.secoes.map(s => [s.titulo, s.cards.map(converter)]));
}

function rodarNasDuasVersoes(entrada) {
  const antigo = comparavel(legado.atualizar(entrada), c => c);
  const novo = comparavel(atualizarNovo(entrada), noFormatoAntigo);
  // A versão anterior desenhava a seção Santander mesmo sem nenhum card; a nova a omite.
  if (antigo['Financiamento Santander']?.length === 0) delete antigo['Financiamento Santander'];
  return { antigo, novo };
}

// ── Cenários ─────────────────────────────────────────────────────────────────

const AGORA = new Date(2026, 9, 23, 10, 0); // 23/10/2026 10:00

const VALORES = ['0,01', '1,00', '99,99', '1.000,00', '1.234,56', '12.345,67', '50.000,00', '99.999,99', '1.234.567,89'];

const MODOS_TESTADOS = ['com', 'sem30', 'sem60'];

const DATAS = {
  'padrão (hoje e +1 mês)':      ['23/10/2026', '23/11/2026'],
  'sem60 (hoje e +60 dias)':     ['23/10/2026', '22/12/2026'],
  'entrada no limite (+6 dias)': ['29/10/2026', '30/11/2026'],
  'fim de mês (31 → fevereiro)': ['23/10/2026', '31/01/2027'],
  'entrada no passado':          ['01/10/2026', '15/11/2026'],
  'virada de ano':               ['28/10/2026', '28/12/2026'],
};

const DATAS_INVALIDAS = {
  'entrada além de +6 dias':     ['30/10/2026', '30/11/2026'],
  'parcela antes da entrada':    ['23/10/2026', '20/10/2026'],
  'parcela igual à entrada':     ['23/10/2026', '23/10/2026'],
  'entrada vazia':               ['', '23/11/2026'],
  'parcela vazia':               ['23/10/2026', ''],
  'ambas vazias':                ['', ''],
  'datas incompletas':           ['23/10/20', '23/1'],
  'data inexistente':            ['32/13/2026', '23/11/2026'],
};

const todos = (n, valor) => Array(n).fill(valor);

const CONFIGS = {
  'padrão (nada salvo)': null,
  'fatores e descontos alterados no admin': {
    fatorCorrecao: 0.18,
    santander: legado.DEFAULTS.santander.map(f => f * 1.013),
    santander60: legado.DEFAULTS.santander60.map(f => f * 0.987),
    boleto: [0.22, 0.17, 0.155, 0.141, 0.133, 0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.06],
    cartao: [0.15, 0.135, 0.125, 0.115, 0.105, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03],
  },
  'salvo por versão antiga (só 12 parcelas)': {
    fatorCorrecao: 0.1665,
    santander: legado.DEFAULTS.santander.slice(0, 12),
    santander60: legado.DEFAULTS.santander60.slice(0, 12),
    boleto: legado.DEFAULTS.boleto,
    cartao: legado.DEFAULTS.cartao,
    habilitados: { santanderCom: todos(12, true), santander30: todos(12, true), santander60: todos(12, true) },
  },
  'todas as opções habilitadas (1× a 18×)': {
    habilitados: {
      boleto: todos(12, true), santanderCom: todos(18, true), santander30: todos(18, true),
      santander60: todos(18, true), cartao: todos(13, true),
    },
  },
  'fator de correção zero': { fatorCorrecao: 0 },
  'só algumas opções': {
    habilitados: {
      boleto: [true, false, true], santanderCom: [false, false, false, false, false, false, false, false, false, false, false, true],
      santander30: [false, false, true], santander60: todos(18, false), cartao: [false, true],
    },
  },
};

// Gera todas as combinações valor × modo × datas × config
function combinacoes(datas) {
  const lista = [];
  for (const [nomeCfg, cfg] of Object.entries(CONFIGS))
    for (const [nomeDatas, [dataEntradaTexto, dataParcelaTexto]] of Object.entries(datas))
      for (const modo of MODOS_TESTADOS)
        for (const valorTexto of VALORES)
          lista.push([`${nomeCfg} | ${nomeDatas} | ${modo} | R$ ${valorTexto}`,
            { valorTexto, dataEntradaTexto, dataParcelaTexto, modo, cfg, agora: AGORA }]);
  return lista;
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('cards gerados: versão anterior × versão atual', () => {
  test.each(combinacoes(DATAS))('%s', (_, entrada) => {
    const { antigo, novo } = rodarNasDuasVersoes(entrada);
    expect(novo).toEqual(antigo);
  });
});

describe('erros de data: versão anterior × versão atual', () => {
  test.each(combinacoes(DATAS_INVALIDAS))('%s', (_, entrada) => {
    const { antigo, novo } = rodarNasDuasVersoes(entrada);
    expect(novo).toEqual(antigo);
  });
});

describe('valor vazio ou zero mostra o placeholder nas duas versões', () => {
  test.each(['', '0,00', ',', 'abc'])('%p', valorTexto => {
    const entrada = { valorTexto, dataEntradaTexto: '23/10/2026', dataParcelaTexto: '', modo: 'com', cfg: null, agora: AGORA };
    expect(atualizarNovo(entrada)).toEqual({ placeholder: true });
    expect(legado.atualizar(entrada)).toEqual({ placeholder: true });
  });
});

describe('máscara do valor: versão anterior × versão atual', () => {
  const entradas = ['', '1', '12', '123', '1234', '123456', '1234567', '123456789012', '00012', 'R$ 1.234,56', 'abc', '12a34'];
  test.each(entradas)('%p', texto => expect(calc.mascararMoeda(texto)).toBe(legado.maskValor(texto)));
});

describe('máscara de data: versão anterior × versão atual', () => {
  const entradas = ['', '1', '12', '123', '1234', '12345', '123456', '1234567', '12345678', '123456789', '12/34/5678', '1a2b3c', '18/06/2026'];
  test.each(entradas)('%p', texto => expect(calc.mascararData(texto)).toBe(legado.maskDate(texto)));
});

describe('leitura de data dd/mm/aaaa: versão anterior × versão atual', () => {
  const entradas = ['', '18/06/2026', '01/01/2027', '31/02/2026', '32/01/2026', '00/00/0000', '18/06/202', '18/06', '1/6/2026',
    '12/34/5678', '29/02/2028', '29/02/2027', '10/10/1999', 'aa/bb/cccc'];
  test.each(entradas)('%p', texto => {
    const antigo = legado.parseBR(texto);
    const novo = calc.parseDataBR(texto);
    expect(novo?.getTime() ?? null).toBe(antigo?.getTime() ?? null);
  });
});

describe('data sugerida para a 1ª parcela: versão anterior × versão atual', () => {
  // Um dia de cada mês, incluindo fins de mês (31 + 1 mês, 29/02...)
  const dias = [];
  for (let mes = 0; mes < 14; mes++) for (const dia of [1, 15, 28, 29, 30, 31]) dias.push(new Date(2027, mes, dia, 15, 30));
  test.each(MODOS_TESTADOS)('modo %s', modo => {
    for (const agora of dias) {
      expect(calc.dataPrimeiraParcelaPadrao(modo, agora).getTime()).toBe(legado.dataParcelaParaModo(modo, agora).getTime());
    }
  });
});

describe('formatação: versão anterior × versão atual', () => {
  test('moeda', () => {
    for (const v of [0, 0.005, 0.01, 1, 9.999, 1000, 1234.5, 98765.4321, 1e7]) expect(calc.formatarMoeda(v)).toBe(legado.fmt(v));
  });
  test('data', () => {
    for (const d of [new Date(2026, 0, 1), new Date(2026, 11, 31), null]) expect(calc.formatarData(d)).toBe(legado.fmtData(d));
  });
});

// ── Diferenças intencionais (correções de bug) ───────────────────────────────

describe('diferenças intencionais', () => {
  const entrada = {
    valorTexto: '10.000,00', dataEntradaTexto: '23/10/2026', dataParcelaTexto: '23/11/2026', modo: 'com', agora: AGORA,
    cfg: { habilitados: { boleto: todos(12, false) } },
  };

  test('com todos os boletos desabilitados, a versão anterior também escondia o cartão (bug)', () => {
    const titulos = r => r.secoes.map(s => s.titulo);
    expect(titulos(legado.atualizar(entrada))).toEqual(['Financiamento Santander']);
    expect(titulos(atualizarNovo(entrada))).toEqual(['Financiamento Santander', 'Cartão Visa · Mastercard']);
  });

  test('os cards de cartão exibidos agora são os mesmos que a versão anterior calculava', () => {
    const comBoleto = { ...entrada, cfg: null };
    const cartaoAntigo = comparavel(legado.atualizar(comBoleto), c => c)['Cartão Visa · Mastercard'];
    const cartaoNovo = comparavel(atualizarNovo(entrada), noFormatoAntigo)['Cartão Visa · Mastercard'];
    expect(cartaoNovo).toEqual(cartaoAntigo);
  });

  test('seção Santander sem nenhuma opção habilitada: antes aparecia vazia, agora é omitida', () => {
    const semSantander = { ...entrada, cfg: { habilitados: { santanderCom: todos(18, false) } } };
    expect(legado.atualizar(semSantander).secoes.find(s => s.titulo === 'Financiamento Santander').cards).toEqual([]);
    expect(atualizarNovo(semSantander).secoes.find(s => s.titulo === 'Financiamento Santander')).toBeUndefined();
  });
});
