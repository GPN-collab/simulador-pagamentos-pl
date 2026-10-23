const calc = require('../js/calc');
const { DEFAULTS, normalizar } = require('../js/config');

const {
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
  maxDataEntrada,
  isDataEntradaValida,
  dataPrimeiraParcelaPadrao,
  calcularDatas,
  validarDatas,
  calcularBoleto,
  calcularCartao,
  calcularSantander,
  resumirParcelas,
} = calc;

const HOJE = new Date(2026, 5, 18, 12); // 18/06/2026

// ── Formatação e máscaras ─────────────────────────────────────────────────────

describe('formatarMoeda', () => {
  test.each([
    [1000, 'R$ 1.000,00'],
    [1234.56, 'R$ 1.234,56'],
    [99.9, 'R$ 99,90'],
    [0, 'R$ 0,00'],
    [1234567.8, 'R$ 1.234.567,80'],
  ])('%p → %p', (valor, esperado) => expect(formatarMoeda(valor)).toBe(esperado));
});

describe('parseMoeda', () => {
  test('converte texto mascarado em número', () => expect(parseMoeda('12.345,67')).toBeCloseTo(12345.67));
  test('texto vazio vira NaN', () => expect(parseMoeda('')).toBeNaN());
});

describe('formatarPercentual', () => {
  test('usa vírgula decimal', () => expect(formatarPercentual(0.1023, 1)).toBe('10,2'));
  test('sem casas decimais', () => expect(formatarPercentual(0.2, 0)).toBe('20'));
});

describe('mascararMoeda', () => {
  test('dígitos viram centavos', () => expect(mascararMoeda('1234567')).toBe('12.345,67'));
  test('ignora caracteres não numéricos', () => expect(mascararMoeda('12.345,678')).toBe('123.456,78'));
  test('vazio continua vazio', () => expect(mascararMoeda('')).toBe(''));
});

describe('mascararData', () => {
  test.each([
    ['1', '1'],
    ['12', '12'],
    ['123', '12/3'],
    ['1234', '12/34'],
    ['12345', '12/34/5'],
    ['18062026', '18/06/2026'],
    ['180620261', '18/06/2026'],
    ['18/06/2026', '18/06/2026'],
  ])('%p → %p', (texto, esperado) => expect(mascararData(texto)).toBe(esperado));
});

// ── Datas ─────────────────────────────────────────────────────────────────────

describe('formatarData / formatarDataISO', () => {
  test('dd/mm/aaaa com zeros à esquerda', () => expect(formatarData(new Date(2026, 0, 5))).toBe('05/01/2026'));
  test('null para data ausente', () => expect(formatarData(null)).toBeNull());
  test('aaaa-mm-dd', () => expect(formatarDataISO(new Date(2026, 0, 5))).toBe('2026-01-05'));
  test('isoParaBR', () => expect(isoParaBR('2026-01-05')).toBe('05/01/2026'));
});

describe('parseDataBR', () => {
  test('lê data válida ao meio-dia', () => {
    const d = parseDataBR('18/06/2026');
    expect(formatarData(d)).toBe('18/06/2026');
    expect(d.getHours()).toBe(12);
  });
  test.each(['', '18/06', '18/06/26', '1/6/2026', '32/13/2026', null])('rejeita %p', texto =>
    expect(parseDataBR(texto)).toBeNull());
});

describe('somarMeses', () => {
  test('cruza o ano', () => expect(formatarData(somarMeses(new Date(2026, 10, 1), 3))).toBe('01/02/2027'));
  test('não altera a data original', () => {
    const base = new Date(2026, 5, 18);
    somarMeses(base, 2);
    expect(formatarData(base)).toBe('18/06/2026');
  });
});

describe('dataPrimeiraParcelaPadrao', () => {
  test('sem60 → hoje + 60 dias', () => expect(formatarData(dataPrimeiraParcelaPadrao('sem60', HOJE))).toBe('17/08/2026'));
  test('sem30 → próximo mês', () => expect(formatarData(dataPrimeiraParcelaPadrao('sem30', HOJE))).toBe('18/07/2026'));
  test('com → próximo mês', () => expect(formatarData(dataPrimeiraParcelaPadrao('com', HOJE))).toBe('18/07/2026'));
});

describe('data máxima da entrada (hoje + 6 dias)', () => {
  test('máximo', () => expect(formatarData(maxDataEntrada(HOJE))).toBe('24/06/2026'));
  test('hoje é válido', () => expect(isDataEntradaValida(new Date(2026, 5, 18), HOJE)).toBe(true));
  test('d+6 é válido', () => expect(isDataEntradaValida(new Date(2026, 5, 24, 23), HOJE)).toBe(true));
  test('d+7 é inválido', () => expect(isDataEntradaValida(new Date(2026, 5, 25), HOJE)).toBe(false));
  test('passado é válido', () => expect(isDataEntradaValida(new Date(2026, 5, 1), HOJE)).toBe(true));
});

describe('calcularDatas', () => {
  const datas = { dataEntrada: new Date(2026, 5, 18), dataPrimeiraParcela: new Date(2026, 6, 20) };

  test('com entrada: entrada na data da entrada, mensais a partir da 1ª parcela', () => {
    const { parcelas } = calcularSantander(1000, 3, { fatores: DEFAULTS.santander, fatorCorrecao: 0, comEntrada: true });
    expect(calcularDatas(parcelas, { ...datas, comEntrada: true })).toEqual(['18/06/2026', '20/07/2026', '20/08/2026']);
  });

  test('sem entrada: todas a partir da 1ª parcela', () => {
    const { parcelas } = calcularSantander(1000, 3, { fatores: DEFAULTS.santander, fatorCorrecao: 0, comEntrada: false });
    expect(calcularDatas(parcelas, { ...datas, comEntrada: false })).toEqual(['20/07/2026', '20/08/2026', '20/09/2026']);
  });

  test('pagamento único cai na data da entrada', () => {
    const { parcelas } = calcularCartao(1000, 1, 0.16);
    expect(calcularDatas(parcelas, { ...datas, comEntrada: true })).toEqual(['18/06/2026']);
  });

  test('cartão parcelado: 1ª cobrança um mês antes da 1ª parcela', () => {
    const { parcelas } = calcularCartao(1000, 3, 0.12);
    expect(calcularDatas(parcelas, { ...datas, comEntrada: true })).toEqual(['20/06/2026', '20/07/2026', '20/08/2026']);
  });

  test('sem data da 1ª parcela: datas vazias', () => {
    const { parcelas } = calcularSantander(1000, 2, { fatores: DEFAULTS.santander, fatorCorrecao: 0, comEntrada: false });
    expect(calcularDatas(parcelas, { dataEntrada: null, dataPrimeiraParcela: null, comEntrada: false })).toEqual([null, null]);
  });
});

// ── Validação ─────────────────────────────────────────────────────────────────

describe('validarDatas', () => {
  const entrada = new Date(2026, 5, 18, 12);
  const parcela = new Date(2026, 6, 18, 12);
  const validar = extra => validarDatas({ dataEntrada: entrada, dataPrimeiraParcela: parcela, comEntrada: true, hoje: HOJE, ...extra });

  test('datas corretas', () => expect(validar()).toEqual({ entrada: null, parcela: null }));
  test('entrada obrigatória com entrada', () => expect(validar({ dataEntrada: null }).entrada).toBe('Campo obrigatório'));
  test('entrada além de hoje + 6', () =>
    expect(validar({ dataEntrada: new Date(2026, 5, 25, 12) }).entrada).toBe('Data máxima: hoje + 6 dias'));
  test('entrada ignorada sem entrada', () =>
    expect(validar({ dataEntrada: null, comEntrada: false })).toEqual({ entrada: null, parcela: null }));
  test('1ª parcela obrigatória', () => expect(validar({ dataPrimeiraParcela: null }).parcela).toBe('Campo obrigatório'));
  test('1ª parcela deve ser após a entrada', () =>
    expect(validar({ dataPrimeiraParcela: entrada }).parcela).toBe('Deve ser após a data da entrada'));
  test('ordem não importa sem entrada', () =>
    expect(validar({ dataPrimeiraParcela: entrada, comEntrada: false }).parcela).toBeNull());
});

// ── Parcelas ──────────────────────────────────────────────────────────────────

describe('calcularBoleto', () => {
  test('à vista com 20% de desconto', () => {
    const { total, parcelas } = calcularBoleto(1000, 1, 0.20, true);
    expect(total).toBeCloseTo(800);
    expect(parcelas).toEqual([{ label: 'Pagamento único', valor: total, entrada: true }]);
  });

  test('1+1 com entrada: duas parcelas iguais', () => {
    const { total, parcelas } = calcularBoleto(1000, 2, 0.16, true);
    expect(total).toBeCloseTo(840);
    expect(parcelas.map(p => p.label)).toEqual(['Entrada', 'Parcela 2']);
    expect(parcelas[0].valor).toBeCloseTo(420);
  });

  test('sem entrada: todas "Parcela N"', () => {
    const { parcelas } = calcularBoleto(1000, 3, 0.15, false);
    expect(parcelas.map(p => p.label)).toEqual(['Parcela 1', 'Parcela 2', 'Parcela 3']);
  });

  test('soma das parcelas = total', () => {
    const { total, parcelas } = calcularBoleto(2000, 4, 0.14, true);
    expect(parcelas.reduce((s, p) => s + p.valor, 0)).toBeCloseTo(total);
  });
});

describe('calcularCartao', () => {
  test('à vista: pagamento único com desconto', () => {
    const { total, parcelas } = calcularCartao(1000, 1, 0.14);
    expect(total).toBeCloseTo(860);
    expect(parcelas[0].label).toBe('Pagamento único');
  });

  test('parcelado: n parcelas iguais, sem entrada', () => {
    const { total, parcelas } = calcularCartao(1000, 4, 0.10);
    expect(total).toBeCloseTo(900);
    expect(parcelas.map(p => p.label)).toEqual(['Parcela 1', 'Parcela 2', 'Parcela 3', 'Parcela 4']);
    parcelas.forEach(p => expect(p.valor).toBeCloseTo(225));
  });
});

describe('calcularSantander', () => {
  const fc = DEFAULTS.fatorCorrecao;
  const santander = (n, comEntrada, fatores = DEFAULTS.santander) =>
    calcularSantander(1000, n, { fatores, fatorCorrecao: fc, comEntrada });

  test('sem entrada: parcela = base × fator[n−1]', () => {
    const { parcelas, total } = santander(6, false);
    expect(parcelas).toHaveLength(6);
    expect(parcelas[0].valor).toBeCloseTo(1000 * (1 - fc) * DEFAULTS.santander[5]);
    expect(total).toBeCloseTo(parcelas[0].valor * 6);
  });

  test('com entrada: parcela = (base − base/n) × fator[n−2]', () => {
    const { parcelas } = santander(6, true);
    const base = 1000 * (1 - fc);
    expect(parcelas[0]).toMatchObject({ label: 'Entrada', entrada: true });
    parcelas.forEach(p => expect(p.valor).toBeCloseTo((base - base / 6) * DEFAULTS.santander[4]));
  });

  test('60 dias custa mais que 30 dias', () => {
    expect(santander(6, false, DEFAULTS.santander60).total).toBeGreaterThan(santander(6, false).total);
  });

  test('valores de referência da planilha (R$ 12.345,67)', () => {
    const r = calcularSantander(12345.67, 6, { fatores: DEFAULTS.santander, fatorCorrecao: fc, comEntrada: true });
    expect(formatarMoeda(r.total)).toBe('R$ 11.084,14');
    expect(formatarMoeda(r.parcelas[0].valor)).toBe('R$ 1.847,36');
  });
});

describe('resumirParcelas', () => {
  test('pagamento único', () =>
    expect(resumirParcelas(calcularCartao(1000, 1, 0).parcelas)).toEqual([{ texto: 'Pagamento único', destaque: '' }]));
  test('com entrada', () =>
    expect(resumirParcelas(calcularBoleto(1000, 3, 0.1, true).parcelas)).toEqual([
      { texto: 'Entrada ', destaque: 'R$ 300,00' },
      { texto: '2× de ', destaque: 'R$ 300,00' },
    ]));
  test('sem entrada', () =>
    expect(resumirParcelas(calcularCartao(1000, 4, 0).parcelas)).toEqual([{ texto: '', destaque: '4× de R$ 250,00' }]));
});

// ── Configuração ──────────────────────────────────────────────────────────────

describe('normalizar', () => {
  test('sem nada salvo usa os padrões', () => expect(normalizar(null)).toEqual(JSON.parse(JSON.stringify(DEFAULTS))));

  test('completa arrays salvos por versões antigas (12 parcelas)', () => {
    const cfg = normalizar({ santander: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], habilitados: { santander30: Array(12).fill(true) } });
    expect(cfg.santander).toHaveLength(18);
    expect(cfg.santander[0]).toBe(1);
    expect(cfg.santander[12]).toBe(DEFAULTS.santander[12]);
    expect(cfg.habilitados.santander30.slice(12)).toEqual(Array(6).fill(false));
  });

  test('preserva o fator de correção salvo, inclusive zero', () => expect(normalizar({ fatorCorrecao: 0 }).fatorCorrecao).toBe(0));

  test('padrões não podem ser alterados por engano', () => {
    expect(Object.isFrozen(DEFAULTS.santander)).toBe(true);
    expect(Object.isFrozen(DEFAULTS.habilitados.boleto)).toBe(true);
  });
});
