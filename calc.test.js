const {
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
} = require('./calc');

// ── Formatadores ──────────────────────────────────────────────────────────────

describe('fmt', () => {
  test('formata valor inteiro', () => {
    expect(fmt(1000)).toBe('R$ 1.000,00');
  });
  test('formata valor com centavos', () => {
    expect(fmt(1234.56)).toBe('R$ 1.234,56');
  });
  test('formata valor menor que mil', () => {
    expect(fmt(99.9)).toBe('R$ 99,90');
  });
  test('formata zero', () => {
    expect(fmt(0)).toBe('R$ 0,00');
  });
});

describe('fmtData', () => {
  test('formata data para dd/mm/aaaa', () => {
    expect(fmtData(new Date(2026, 5, 18))).toBe('18/06/2026');
  });
  test('preenche zeros à esquerda', () => {
    expect(fmtData(new Date(2026, 0, 5))).toBe('05/01/2026');
  });
  test('retorna null para entrada nula', () => {
    expect(fmtData(null)).toBeNull();
  });
});

describe('addMonths', () => {
  test('adiciona 1 mês', () => {
    const result = addMonths(new Date(2026, 5, 18), 1);
    expect(result.getMonth()).toBe(6);
    expect(result.getFullYear()).toBe(2026);
  });
  test('adiciona meses cruzando ano', () => {
    const result = addMonths(new Date(2026, 10, 1), 3);
    expect(result.getMonth()).toBe(1);
    expect(result.getFullYear()).toBe(2027);
  });
  test('adiciona 0 meses não muda a data', () => {
    const base = new Date(2026, 5, 18);
    const result = addMonths(base, 0);
    expect(result.getTime()).toBe(base.getTime());
  });
});

// ── getDates ──────────────────────────────────────────────────────────────────

describe('getDates — com entrada', () => {
  const dE = new Date(2026, 5, 18);
  const dP = new Date(2026, 6, 18);

  test('1ª parcela (Entrada) recebe data de entrada', () => {
    const parcelas = [{ label: 'Entrada' }, { label: 'Parcela 2' }];
    const dates = getDates(dE, dP, parcelas, false);
    expect(dates[0]).toBe('18/06/2026');
  });

  test('parcelas seguintes somam meses a partir de dP', () => {
    const parcelas = [{ label: 'Entrada' }, { label: 'Parcela 2' }, { label: 'Parcela 3' }];
    const dates = getDates(dE, dP, parcelas, false);
    expect(dates[1]).toBe('18/07/2026');
    expect(dates[2]).toBe('18/08/2026');
  });
});

describe('getDates — sem entrada', () => {
  const dP = new Date(2026, 7, 17); // d+60 a partir de 18/06

  test('todas as parcelas partem de dP com incremento mensal', () => {
    const parcelas = [{ label: 'Parcela 1' }, { label: 'Parcela 2' }, { label: 'Parcela 3' }];
    const dates = getDates(null, dP, parcelas, true);
    expect(dates[0]).toBe('17/08/2026');
    expect(dates[1]).toBe('17/09/2026');
    expect(dates[2]).toBe('17/10/2026');
  });

  test('retorna null em todas quando dP é nulo', () => {
    const parcelas = [{ label: 'Parcela 1' }, { label: 'Parcela 2' }];
    const dates = getDates(null, null, parcelas, true);
    expect(dates).toEqual([null, null]);
  });
});

// ── parcelas_boleto ───────────────────────────────────────────────────────────

describe('parcelas_boleto', () => {
  const cfg = DEFAULTS.boleto;

  test('à vista aplica desconto de 20%', () => {
    const { total, parcelas } = parcelas_boleto(1000, 1, false, cfg);
    expect(total).toBeCloseTo(800);
    expect(parcelas[0].label).toBe('Pagamento único');
    expect(parcelas[0].valor).toBeCloseTo(800);
  });

  test('1+2 com entrada: 2 parcelas iguais, desconto 16%', () => {
    const { total, parcelas } = parcelas_boleto(1000, 2, false, cfg);
    expect(total).toBeCloseTo(840);
    expect(parcelas).toHaveLength(2);
    expect(parcelas[0].label).toBe('Entrada');
    expect(parcelas[1].label).toBe('Parcela 2');
    expect(parcelas[0].valor).toBeCloseTo(420);
  });

  test('sem entrada: todas as parcelas com label "Parcela N"', () => {
    const { parcelas } = parcelas_boleto(1000, 3, true, cfg);
    expect(parcelas).toHaveLength(3);
    parcelas.forEach(p => expect(p.label).toMatch(/^Parcela /));
  });

  test('total é coerente com n × parcela', () => {
    const { total, parcelas } = parcelas_boleto(2000, 4, false, cfg);
    const soma = parcelas.reduce((acc, p) => acc + p.valor, 0);
    expect(soma).toBeCloseTo(total);
  });
});

// ── parcelas_santander ────────────────────────────────────────────────────────

describe('parcelas_santander — sem entrada (30d)', () => {
  const FSant = {};
  DEFAULTS.santander.forEach((v, i) => (FSant[i + 1] = v));
  const fc = DEFAULTS.fatorCorrecao;

  test('n parcelas sem entrada: todas com mesmo valor', () => {
    const { parcelas, total } = parcelas_santander(1000, 6, true, FSant, fc);
    expect(parcelas).toHaveLength(6);
    parcelas.forEach(p => expect(p.label).toMatch(/^Parcela /));
    expect(parcelas[0].valor).toBeCloseTo(parcelas[5].valor);
    expect(total).toBeCloseTo(parcelas[0].valor * 6);
  });

  test('O1 = valor × (1 − fatorCorrecao)', () => {
    const { parcelas } = parcelas_santander(1000, 1, true, FSant, fc);
    const O1 = 1000 * (1 - fc);
    expect(parcelas[0].valor).toBeCloseTo(O1 * FSant[1]);
  });
});

describe('parcelas_santander — sem entrada (60d)', () => {
  const FSant60 = {};
  DEFAULTS.santander60.forEach((v, i) => (FSant60[i + 1] = v));
  const fc = DEFAULTS.fatorCorrecao;

  test('fatores 60d produzem valores maiores que 30d para mesmo n', () => {
    const FSant30 = {};
    DEFAULTS.santander.forEach((v, i) => (FSant30[i + 1] = v));
    const { parcelas: p30 } = parcelas_santander(1000, 6, true, FSant30, fc);
    const { parcelas: p60 } = parcelas_santander(1000, 6, true, FSant60, fc);
    expect(p60[0].valor).toBeGreaterThan(p30[0].valor);
  });

  test('3× sem entrada 60d: 3 parcelas iguais', () => {
    const { parcelas, total } = parcelas_santander(1000, 3, true, FSant60, fc);
    expect(parcelas).toHaveLength(3);
    expect(total).toBeCloseTo(parcelas[0].valor * 3);
  });
});

describe('parcelas_santander — com entrada', () => {
  const FSant = {};
  DEFAULTS.santander.forEach((v, i) => (FSant[i + 1] = v));
  const fc = DEFAULTS.fatorCorrecao;

  test('1ª parcela é Entrada, demais são parcelas mensais', () => {
    const { parcelas } = parcelas_santander(1000, 6, false, FSant, fc);
    expect(parcelas[0].label).toBe('Entrada');
    expect(parcelas[1].label).toBe('Parcela 2');
    expect(parcelas).toHaveLength(6);
  });

  test('todas as parcelas têm o mesmo valor', () => {
    const { parcelas } = parcelas_santander(1000, 6, false, FSant, fc);
    const v0 = parcelas[0].valor;
    parcelas.forEach(p => expect(p.valor).toBeCloseTo(v0));
  });
});

// ── parcelas_cartao ───────────────────────────────────────────────────────────

describe('parcelas_cartao', () => {
  test('à vista aplica desconto e retorna pagamento único', () => {
    const { total, parcelas } = parcelas_cartao(1000, 0.14, 1);
    expect(total).toBeCloseTo(860);
    expect(parcelas[0].label).toBe('Pagamento único');
  });

  test('parcelado divide em n parcelas iguais', () => {
    const { total, parcelas } = parcelas_cartao(1000, 0.10, 4);
    expect(parcelas).toHaveLength(4);
    expect(total).toBeCloseTo(900);
    parcelas.forEach(p => expect(p.valor).toBeCloseTo(225));
  });
});

// ── Data da parcela por modo (syncEntradaVisibility) ─────────────────────────

describe('getDataParcelaParaModo', () => {
  const hoje = new Date(2026, 5, 18); // 18/06/2026

  test('modo sem60 → hoje + 60 dias', () => {
    const result = getDataParcelaParaModo('sem60', hoje);
    expect(fmtData(result)).toBe('17/08/2026');
  });

  test('modo sem30 → próximo mês', () => {
    const result = getDataParcelaParaModo('sem30', hoje);
    expect(fmtData(result)).toBe('18/07/2026');
  });

  test('modo com → próximo mês', () => {
    const result = getDataParcelaParaModo('com', hoje);
    expect(fmtData(result)).toBe('18/07/2026');
  });

  test('sem60 e sem30 produzem datas diferentes', () => {
    const d60 = getDataParcelaParaModo('sem60', hoje);
    const d30 = getDataParcelaParaModo('sem30', hoje);
    expect(d60.getTime()).toBeGreaterThan(d30.getTime());
  });
});

// ── Validação da data de entrada (máximo d+6) ─────────────────────────────────

describe('maxDataEntrada', () => {
  const hoje = new Date(2026, 5, 18); // 18/06/2026

  test('máximo é hoje + 6 dias', () => {
    expect(fmtData(maxDataEntrada(hoje))).toBe('24/06/2026');
  });
});

describe('isDataEntradaValida', () => {
  const hoje = new Date(2026, 5, 18);

  test('hoje é válido', () => {
    expect(isDataEntradaValida(new Date(2026, 5, 18), hoje)).toBe(true);
  });

  test('d+6 é válido', () => {
    expect(isDataEntradaValida(new Date(2026, 5, 24), hoje)).toBe(true);
  });

  test('d+7 é inválido', () => {
    expect(isDataEntradaValida(new Date(2026, 5, 25), hoje)).toBe(false);
  });

  test('data no passado é válida (sem restrição de mínimo aqui)', () => {
    expect(isDataEntradaValida(new Date(2026, 5, 1), hoje)).toBe(true);
  });
});
