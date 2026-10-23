/**
 * Configuração compartilhada entre o simulador (index.html) e o portal (admin.html):
 * valores padrão da planilha Santander, conexão com o Firebase e normalização
 * do documento de configuração salvo.
 *
 * Funciona no navegador (expõe `window.PLConfig`) e no Node (via `require`).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PLConfig = api;
})(globalThis, function () {
  'use strict';

  // Chave do cache local (localStorage) e caminho do documento no Firestore.
  const STORAGE_KEY = 'pl_config';
  const FIRESTORE_COLLECTION = 'configs';
  const FIRESTORE_DOC = 'pl_config';

  const FIREBASE = {
    apiKey: 'AIzaSyDemUzzULetjKUikLEYmE6TqdoSwTpNQbU',
    authDomain: 'simulador-pagamento-pl.firebaseapp.com',
    projectId: 'simulador-pagamento-pl',
    storageBucket: 'simulador-pagamento-pl.firebasestorage.app',
    messagingSenderId: '726755271319',
    appId: '1:726755271319:web:71431b70731bcbeb713fd2',
  };

  // Valores padrão da planilha Santander (Mega Planilha Prima Linea).
  // Em todos os arrays, o índice 0 corresponde a 1 parcela.
  const DEFAULTS = deepFreeze({
    // Desconto aplicado sobre o valor antes do cálculo Santander: base = valor × (1 − fator)
    fatorCorrecao: 0.1665,

    // Fatores multiplicadores Santander, recebimento em 30 dias (1× a 18×)
    santander: [
      1.0253, 0.5190540118, 0.350340458, 0.2660100047, 0.2154327824,
      0.1817321657, 0.1567768837, 0.1387546517, 0.1247476901,
      0.1135514091, 0.1043992506, 0.09678017505,
      // 13×–18×: provisórios — preencher com os valores reais do Santander antes de habilitar
      0.0900, 0.0840, 0.0787, 0.0741, 0.0700, 0.0663,
    ],

    // Fatores multiplicadores Santander, recebimento em 60 dias (1× a 18×)
    santander60: [
      1.05124, 0.53219, 0.3592, 0.27274, 0.22088,
      0.18633, 0.16051, 0.14206, 0.12772,
      0.11625, 0.10688, 0.09908,
      // 13×–18×: provisórios
      0.0921, 0.0859, 0.0805, 0.0757, 0.0714, 0.0676,
    ],

    // Descontos boleto/cheque/dinheiro: à vista, 2× a 12×
    boleto: [0.20, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06],

    // Descontos cartão: débito, crédito à vista, 2× a 12×
    cartao: [0.16, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03],

    // Opções exibidas no simulador (mesmos índices dos arrays acima)
    habilitados: {
      boleto:       [true, true, true, true, true, false, false, false, false, false, false, false],
      santanderCom: [false, false, false, false, false, true, true, true, true, true, true, true, false, false, false, false, false, false],
      santander30:  [false, false, true, true, true, true, true, true, true, true, true, true, false, false, false, false, false, false],
      santander60:  [false, false, true, true, true, true, true, true, true, true, true, true, false, false, false, false, false, false],
      cartao:       [true, true, true, true, true, true, false, false, false, false, false, false, false],
    },
  });

  /**
   * Devolve uma configuração completa a partir de um documento salvo.
   * Campos ausentes (ex.: salvos por uma versão anterior com menos parcelas)
   * assumem o valor padrão — e opções novas, portanto, vêm desabilitadas.
   */
  function normalizar(salvo) {
    const cfg = salvo || {};
    const hab = cfg.habilitados || {};
    const completar = (valores, padrao) => padrao.map((v, i) => valores?.[i] ?? v);

    return {
      fatorCorrecao: cfg.fatorCorrecao ?? DEFAULTS.fatorCorrecao,
      santander:     completar(cfg.santander, DEFAULTS.santander),
      santander60:   completar(cfg.santander60, DEFAULTS.santander60),
      boleto:        completar(cfg.boleto, DEFAULTS.boleto),
      cartao:        completar(cfg.cartao, DEFAULTS.cartao),
      habilitados: Object.fromEntries(
        Object.entries(DEFAULTS.habilitados).map(([chave, padrao]) => [chave, completar(hab[chave], padrao)])
      ),
    };
  }

  /** Lê a última configuração guardada neste navegador, ou `null`. */
  function lerCache() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch {
      return null;
    }
  }

  /** Guarda a configuração neste navegador (cache para uso offline). */
  function gravarCache(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch {
      // Sem localStorage (modo privado, cota cheia): o Firestore continua sendo a fonte.
    }
  }

  /**
   * Referência ao documento de configuração no Firestore,
   * ou `null` se o SDK do Firebase não carregou (ex.: sem internet).
   */
  function documentoFirestore() {
    const { firebase } = globalThis;
    if (!firebase) return null;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE);
    return firebase.firestore().collection(FIRESTORE_COLLECTION).doc(FIRESTORE_DOC);
  }

  function deepFreeze(obj) {
    Object.values(obj).forEach(v => typeof v === 'object' && deepFreeze(v));
    return Object.freeze(obj);
  }

  return { STORAGE_KEY, DEFAULTS, normalizar, lerCache, gravarCache, documentoFirestore };
});
