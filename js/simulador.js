/**
 * Interface do simulador: lê os campos, monta os cards de cada condição de
 * pagamento e gera a impressão A4 / imagem PNG de um card.
 * As contas ficam em js/calc.js e js/simulacao.js; os valores configuráveis, em js/config.js.
 */
(function () {
  'use strict';

  const calc = window.PLCalc;
  const { MODOS, montarSecoes } = window.PLSimulacao;
  const { normalizar, lerCache, gravarCache, documentoFirestore } = window.PLConfig;
  const { formatarMoeda } = calc;

  const ICONES = {
    info:     '<svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M5 1v4M5 7.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="5" cy="5" r="4.25" stroke="currentColor" stroke-width="1.2"/></svg>',
    imprimir: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    salvar:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  };

  // ── Elementos da página ────────────────────────────────────────────────────

  const $ = seletor => document.querySelector(seletor);
  const el = {
    valor:         $('#valor'),
    dataEntrada:   $('#dataEntrada'),
    dataParcela:   $('#dataParcela'),
    entradaGroup:  $('#entrada-group'),
    entradaError:  $('#entrada-error'),
    parcelaError:  $('#parcela-error'),
    modos:         document.querySelectorAll('input[name="modo"]'),
    resultado:     $('#resultado'),
    placeholder:   $('#placeholder-template'),
    printFrame:    $('#print-frame'),
    loading:       $('#loading'),
  };
  const seletorNativo = campo => campo.parentElement.querySelector('.date-native');

  // ── Estado ─────────────────────────────────────────────────────────────────

  let config = normalizar(lerCache());
  let cards = []; // dados dos cards renderizados, usados na impressão e na imagem

  const modoAtual = () => document.querySelector('input[name="modo"]:checked').value;

  // ── HTML ───────────────────────────────────────────────────────────────────

  function htmlTabelaParcelas(c) {
    const linhas = c.parcelas.map((p, i) => `
      <tr>
        <td class="schedule-n">${i + 1}</td>
        <td class="schedule-label">${p.label}</td>
        <td class="schedule-date">${c.datas[i] ?? ''}</td>
        <td class="schedule-value">${formatarMoeda(p.valor)}</td>
      </tr>`).join('');
    return `
      <table class="schedule">${linhas}
        <tr class="schedule-total">
          <td></td><td class="schedule-label">Total</td><td></td><td class="schedule-value">${formatarMoeda(c.total)}</td>
        </tr>
      </table>`;
  }

  function htmlCard(c, indice) {
    const resumo = c.resumo.map(l => `<div>${l.texto}<strong>${l.destaque}</strong></div>`).join('');
    return `
      <div class="card" data-card="${indice}">
        <div class="card-top"></div>
        <div class="card-body">
          <div class="card-label">${c.titulo}</div>
          <span class="card-badge">${c.selo}</span>
          <div class="card-total">
            <span class="card-total-label">Total</span>
            <span class="card-total-value">${formatarMoeda(c.total)}</span>
          </div>
          <div class="card-summary">${resumo}</div>
          <div class="card-hint">${ICONES.info} Ver parcelas detalhadas</div>
        </div>
        <div class="card-expand">
          <div class="card-schedule">
            <div class="schedule-title">Calendário de pagamentos</div>
            ${htmlTabelaParcelas(c)}
          </div>
          <div class="card-actions">
            <button type="button" class="btn-action" data-acao="imprimir">${ICONES.imprimir} Imprimir A4</button>
            <button type="button" class="btn-action" data-acao="imagem">${ICONES.salvar} Salvar imagem</button>
          </div>
        </div>
      </div>`;
  }

  function htmlSecao(secao) {
    const htmlCards = secao.cards.map(c => htmlCard(c, cards.push(c) - 1)).join('');
    return `
      <section class="section tema-${secao.tema}">
        <div class="section-header"><h2 class="section-label">${secao.titulo}</h2></div>
        <div class="cards-grid">${htmlCards}</div>
      </section>`;
  }

  // ── Atualização da tela ────────────────────────────────────────────────────

  function mostrarErro(campo, mensagemEl, mensagem) {
    mensagemEl.textContent = mensagem ?? '';
    campo.classList.toggle('error', Boolean(mensagem));
  }

  /** Recalcula e redesenha todas as condições. Chamada a cada mudança nos campos. */
  function atualizar() {
    const valor = calc.parseMoeda(el.valor.value);
    const modo = modoAtual();
    const datas = {
      dataEntrada: calc.parseDataBR(el.dataEntrada.value),
      dataPrimeiraParcela: calc.parseDataBR(el.dataParcela.value),
    };

    if (!(valor > 0)) {
      mostrarErro(el.dataEntrada, el.entradaError, null);
      mostrarErro(el.dataParcela, el.parcelaError, null);
      el.resultado.replaceChildren(el.placeholder.content.cloneNode(true));
      return;
    }

    const erros = calc.validarDatas({ ...datas, comEntrada: MODOS[modo].comEntrada, hoje: new Date() });
    mostrarErro(el.dataEntrada, el.entradaError, erros.entrada);
    mostrarErro(el.dataParcela, el.parcelaError, erros.parcela);
    if (erros.entrada || erros.parcela) return;

    cards = [];
    el.resultado.innerHTML = montarSecoes(valor, modo, datas, config).map(htmlSecao).join('');
  }

  /** Preenche a data da 1ª parcela com a sugestão da modalidade escolhida. */
  function sugerirDataParcela() {
    definirData(el.dataParcela, calc.dataPrimeiraParcelaPadrao(modoAtual(), new Date()));
  }

  function definirData(campo, data) {
    campo.value = calc.formatarData(data);
    seletorNativo(campo).value = calc.formatarDataISO(data);
  }

  // ── Impressão A4 ───────────────────────────────────────────────────────────
  // O CSS de impressão esconde a página e mostra só o #print-frame.

  function imprimir(c) {
    const linhas = c.parcelas.map((p, i) => `
      <tr>
        <td class="doc-a4-n">${i + 1}</td>
        <td class="doc-a4-label">${p.label}</td>
        <td class="doc-a4-date">${c.datas[i] ?? ''}</td>
        <td class="doc-a4-value">${formatarMoeda(p.valor)}</td>
      </tr>`).join('');

    el.printFrame.innerHTML = `
      <div class="doc doc-a4 tema-${c.tema}">
        <div class="doc-a4-header">
          <div>
            <div class="doc-kicker">Prima Linea · Condição de Pagamento</div>
            <div class="doc-title">${c.titulo}</div>
            <div class="doc-badge">${c.selo}</div>
          </div>
          <div class="doc-a4-budget">
            <div class="doc-caption">Orçamento</div>
            <div class="doc-a4-budget-value">R$ ${el.valor.value}</div>
          </div>
        </div>

        <div class="doc-a4-boxes">
          <div class="doc-a4-box">
            <div class="doc-caption">Total a pagar</div>
            <div class="doc-a4-total">${formatarMoeda(c.total)}</div>
          </div>
          <div class="doc-a4-box">
            <div class="doc-caption">Forma</div>
            <div class="doc-a4-terms">${c.resumo.map(l => l.texto + l.destaque).join('<br>')}</div>
          </div>
        </div>

        <div class="doc-caption">Calendário de Pagamentos</div>
        <table class="doc-a4-table">${linhas}
          <tr class="doc-a4-sum">
            <td></td><td class="doc-a4-label">Total</td><td></td><td class="doc-a4-value">${formatarMoeda(c.total)}</td>
          </tr>
        </table>

        <div class="doc-footer">PRIMA LINEA · ${calc.formatarData(new Date())}</div>
      </div>`;
    window.print();
  }

  // ── Exportação PNG ─────────────────────────────────────────────────────────
  // Monta o layout fora da tela, renderiza com html2canvas e baixa o arquivo.

  async function salvarImagem(c) {
    const linhas = c.parcelas.map((p, i) => `
      <div class="doc-image-row">
        <span class="doc-image-n">${i + 1}</span>
        <span class="doc-image-label">${p.label}</span>
        ${c.datas[i] ? `<span class="doc-image-date">${c.datas[i]}</span>` : ''}
        <span class="doc-image-value">${formatarMoeda(p.valor)}</span>
      </div>`).join('');

    const node = document.createElement('div');
    node.className = `doc doc-image tema-${c.tema}`;
    node.innerHTML = `
      <div class="doc-image-header">
        <div class="doc-kicker">Prima Linea · Condição de Pagamento</div>
        <div class="doc-title">${c.titulo}</div>
        <div class="doc-badge">${c.selo}</div>
      </div>
      <div class="doc-image-body">
        <div class="doc-image-boxes">
          <div class="doc-image-box">
            <div class="doc-caption">Orçamento</div>
            <div class="doc-image-budget">R$ ${el.valor.value}</div>
          </div>
          <div class="doc-image-box doc-image-box--total">
            <div class="doc-caption">Total a pagar</div>
            <div class="doc-image-total">${formatarMoeda(c.total)}</div>
          </div>
        </div>
        <div class="doc-caption">Parcelas</div>
        ${linhas}
        <div class="doc-image-sum">
          <span class="doc-caption">Total</span>
          <span class="doc-image-sum-value">${formatarMoeda(c.total)}</span>
        </div>
        <div class="doc-footer">PRIMA LINEA · ${calc.formatarData(new Date())}</div>
      </div>`;

    el.loading.hidden = false;
    document.body.appendChild(node);
    try {
      const canvas = await window.html2canvas(node, { scale: 2.5, useCORS: true, backgroundColor: '#F9F6F2' });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      baixarArquivo(blob, `prima-linea-${slug(c.titulo)}.png`);
    } finally {
      node.remove();
      el.loading.hidden = true;
    }
  }

  function baixarArquivo(blob, nome) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = nome;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** "À vista" → "a-vista", "1+5 Santander" → "1-5-santander" */
  function slug(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  // ── Eventos ────────────────────────────────────────────────────────────────

  el.valor.addEventListener('input', () => {
    el.valor.value = calc.mascararMoeda(el.valor.value);
    atualizar();
  });

  for (const campo of [el.dataEntrada, el.dataParcela]) {
    campo.addEventListener('input', () => {
      campo.value = calc.mascararData(campo.value);
      if (campo.value.length === 10) atualizar();
    });
    campo.addEventListener('blur', atualizar);

    // Data escolhida no calendário nativo → copia para o campo de texto
    const nativo = seletorNativo(campo);
    nativo.addEventListener('change', () => {
      if (!nativo.value) return;
      campo.value = calc.isoParaBR(nativo.value);
      atualizar();
    });
  }

  el.modos.forEach(radio => radio.addEventListener('change', () => {
    el.entradaGroup.hidden = !MODOS[modoAtual()].comEntrada;
    sugerirDataParcela();
    atualizar();
  }));

  // Clique no card abre/fecha o calendário; os botões imprimem ou exportam.
  el.resultado.addEventListener('click', evento => {
    const cardEl = evento.target.closest('.card');
    if (!cardEl) return;
    const botao = evento.target.closest('[data-acao]');
    const c = cards[cardEl.dataset.card];
    if (!botao) cardEl.classList.toggle('expanded');
    else if (botao.dataset.acao === 'imprimir') imprimir(c);
    else salvarImagem(c);
  });

  // Configuração alterada no portal admin: em tempo real pelo Firestore,
  // ou por outra aba deste mesmo navegador.
  function aplicarConfig(salvo) {
    config = normalizar(salvo);
    atualizar();
  }

  documentoFirestore()?.onSnapshot(snap => {
    if (!snap.exists) return;
    gravarCache(snap.data());
    aplicarConfig(snap.data());
  }, () => {});

  window.addEventListener('storage', () => aplicarConfig(lerCache()));

  // ── Inicialização ──────────────────────────────────────────────────────────

  const hoje = new Date();
  const nativoEntrada = seletorNativo(el.dataEntrada);
  nativoEntrada.min = calc.formatarDataISO(hoje);
  nativoEntrada.max = calc.formatarDataISO(calc.maxDataEntrada(hoje));
  definirData(el.dataEntrada, hoje);
  sugerirDataParcela();
  atualizar();
})();
