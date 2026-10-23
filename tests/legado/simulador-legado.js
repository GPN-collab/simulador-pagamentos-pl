/**
 * VERSÃO ANTERIOR do simulador, congelada como referência para os testes de
 * equivalência (tests/equivalencia.test.js). NÃO É USADA PELO SITE.
 *
 * O código abaixo foi copiado do <script> do index.html no commit 8ed8c4d
 * (antes da reorganização). As fórmulas, rótulos e formatações estão intactos;
 * as únicas adaptações são as necessárias para rodar fora do navegador:
 *   - a configuração é recebida por parâmetro (antes vinha de localStorage e
 *     de variáveis globais `window._cfg*`);
 *   - buildCard devolve o objeto `payload` que o card guardava em
 *     `data-payload`, em vez do HTML;
 *   - validateDates devolve as mensagens que seriam exibidas, em vez de
 *     mexer nos elementos da página;
 *   - "hoje" é recebido por parâmetro, para os testes serem reproduzíveis.
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
  boleto: [
    0.20, 0.16, 0.15, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06
  ],
  cartao: [
    0.16, 0.14, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03
  ],
  habilitados: {
    boleto:       [true,true,true,true,true, false,false,false,false,false,false,false],
    santanderCom: [false,false,false,false,false, true,true,true,true,true,true,true, false,false,false,false,false,false],
    santander30:  [false,false, true,true,true,true,true,true,true,true,true,true, false,false,false,false,false,false],
    santander60:  [false,false, true,true,true,true,true,true,true,true,true,true, false,false,false,false,false,false],
    cartao:       [true,true,true,true,true,true, false,false,false,false,false,false,false],
  }
};

// Estado que o original guardava em variáveis globais (preenchido por reloadCfg)
let FATOR_CORRECAO, FSant, FSant60, _cfgBoleto, _cfgCartao, _cfgHab;

// Original: lia `getCfg()` (localStorage); aqui recebe o config salvo.
function reloadCfg(cfg) {
  cfg = cfg || DEFAULTS;
  FATOR_CORRECAO = cfg.fatorCorrecao ?? DEFAULTS.fatorCorrecao;
  const sant   = Array.from({length:18}, (_,i) => cfg.santander?.[i]  ?? DEFAULTS.santander[i]);
  const sant60 = Array.from({length:18}, (_,i) => cfg.santander60?.[i] ?? DEFAULTS.santander60[i]);
  FSant = {};   sant.forEach((v,i)   => FSant[i+1]   = v);
  FSant60 = {}; sant60.forEach((v,i) => FSant60[i+1] = v);
  _cfgBoleto = Array.from({length:12}, (_,i) => cfg.boleto?.[i]  ?? DEFAULTS.boleto[i]);
  _cfgCartao = Array.from({length:13}, (_,i) => cfg.cartao?.[i]  ?? DEFAULTS.cartao[i]);
  const defHab = DEFAULTS.habilitados;
  const cfgHab = cfg.habilitados || {};
  _cfgHab = {
    boleto:       Array.from({length:12}, (_,i) => cfgHab.boleto?.[i]       ?? defHab.boleto[i]),
    santanderCom: Array.from({length:18}, (_,i) => cfgHab.santanderCom?.[i] ?? defHab.santanderCom[i]),
    santander30:  Array.from({length:18}, (_,i) => cfgHab.santander30?.[i]  ?? defHab.santander30[i]),
    santander60:  Array.from({length:18}, (_,i) => cfgHab.santander60?.[i]  ?? defHab.santander60[i]),
    cartao:       Array.from({length:13}, (_,i) => cfgHab.cartao?.[i]       ?? defHab.cartao[i]),
  };
}

function fmt(v) {
  return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function fmtData(d) {
  if (!d) return null;
  return [String(d.getDate()).padStart(2,'0'), String(d.getMonth()+1).padStart(2,'0'), d.getFullYear()].join('/');
}
function addMonths(date, n) { const d = new Date(date); d.setMonth(d.getMonth()+n); return d; }

function getDates(dE, dP, parcelas, semEntrada) {
  return parcelas.map((p,i) => {
    if (i===0 && !semEntrada && p.label==='Entrada') return dE ? fmtData(dE) : null;
    const idx = (!semEntrada && p.label!=='Entrada') ? i-1 : i;
    return dP ? fmtData(addMonths(dP, idx)) : null;
  });
}
function getSingleDate(dE) { return dE ? fmtData(dE) : null; }

function parcelas_boleto(valor, n, semEntrada) {
  const descs = {}; _cfgBoleto.forEach((v,i) => descs[i+1]=v);
  const total=valor*(1-descs[n]), p=total/n, result=[];
  if(n===1) result.push({label:'Pagamento único',valor:total});
  else if(semEntrada) for(let i=1;i<=n;i++) result.push({label:`Parcela ${i}`,valor:p});
  else { result.push({label:'Entrada',valor:p}); for(let i=2;i<=n;i++) result.push({label:`Parcela ${i}`,valor:p}); }
  return {parcelas:result,total,desc:descs[n]};
}

function parcelas_santander(valor, n, semEntrada, fatores) {
  const F = fatores || FSant;
  const O1=valor*(1-FATOR_CORRECAO), result=[];
  let total;
  if(semEntrada) {
    const pm=O1*F[n]; total=pm*n;
    for(let i=1;i<=n;i++) result.push({label:`Parcela ${i}`,valor:pm});
  } else {
    const pm=(O1-O1/n)*F[n-1];
    total=pm*n;
    result.push({label:'Entrada',valor:pm});
    for(let i=2;i<=n;i++) result.push({label:`Parcela ${i}`,valor:pm});
  }
  return {parcelas:result,total};
}

function parcelas_cartao(valor, desc, n) {
  const total=valor*(1-desc), p=total/n, result=[];
  if(n===1) result.push({label:'Pagamento único',valor:total});
  else for(let i=1;i<=n;i++) result.push({label:`Parcela ${i}`,valor:p});
  return {parcelas:result,total,desc};
}

// Original: devolvia o HTML do card, com este objeto serializado em data-payload.
function buildCard(label, badge, badgeClass, totalVal, lines, expandData, dates) {
  return {label,badge,badgeClass,totalVal,lines,parcelas:expandData.parcelas,total:expandData.total,dates};
}

function renderBoleto(valor,n,semEntrada,label,dE,dP) {
  const descs = {}; _cfgBoleto.forEach((v,i) => descs[i+1]=v);
  const data=parcelas_boleto(valor,n,semEntrada); const p=data.total/n;
  const lines=n===1?['Pagamento único']:semEntrada?[`<strong>${n}× de ${fmt(p)}</strong>`]:
    [`Entrada <strong>${fmt(p)}</strong>`,`${n-1}× de <strong>${fmt(p)}</strong>`];
  const dates=n===1?[getSingleDate(dE)]:getDates(dE,dP,data.parcelas,semEntrada);
  return buildCard(label,`↓ ${(descs[n]*100).toFixed(0)}% desconto`,'badge-desc',data.total,lines,data,dates);
}

function renderSantander(valor,n,semEntrada,dE,dP,fatores) {
  const data=parcelas_santander(valor,n,semEntrada,fatores);
  const pm=semEntrada?data.parcelas[0].valor:(data.parcelas[1]?.valor??0);
  const entrada=data.parcelas[0].valor;
  const lines=semEntrada?[`<strong>${n}× de ${fmt(pm)}</strong>`]:
    [`Entrada <strong>${fmt(entrada)}</strong>`,`${n-1}× de <strong>${fmt(pm)}</strong>`];
  const pct=((1-data.total/valor)*100).toFixed(1).replace('.',',');
  const badge=`↓ ${pct}% desconto`;
  const sanLabel = semEntrada ? `${n}× Santander` : `1+${n-1} Santander`;
  return buildCard(sanLabel,badge,'badge-santan',data.total,lines,data,getDates(dE,dP,data.parcelas,semEntrada));
}

function renderCartao(valor,label,desc,n,dE,dP) {
  const data=parcelas_cartao(valor,desc,n); const p=data.total/n;
  const lines=n===1?['Pagamento único']:[`<strong>${n}× de ${fmt(p)}</strong>`];
  const dates=n===1?[getSingleDate(dE)]:getDates(dE,dP,data.parcelas,false);
  return buildCard(label,`↓ ${(desc*100).toFixed(0)}% desconto`,'badge-cartao',data.total,lines,data,dates);
}

function parseBR(str) {
  if(!str||str.length<10) return null;
  const [d,m,y] = str.split('/');
  if(!d||!m||!y||y.length<4) return null;
  const dt = new Date(`${y}-${m}-${d}T12:00:00`);
  return isNaN(dt) ? null : dt;
}

// Original: handler de 'input' do campo de data (applyDateMask).
function maskDate(value) {
  let v = value.replace(/\D/g,'');
  if(v.length>2) v = v.slice(0,2)+'/'+v.slice(2);
  if(v.length>5) v = v.slice(0,5)+'/'+v.slice(5,9);
  return v;
}

// Original: handler de 'input' do campo de valor.
function maskValor(value) {
  let d=value.replace(/\D/g,'');
  if(!d) return '';
  return (parseInt(d,10)/100).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
}

// Original: parte de syncEntradaVisibility que sugere a data da 1ª parcela.
function dataParcelaParaModo(modo, agora) {
  const hoje = new Date(agora); hoje.setHours(0,0,0,0);
  const novaDp = new Date(hoje);
  if (modo === 'sem60') {
    novaDp.setDate(novaDp.getDate() + 60);
  } else {
    novaDp.setMonth(novaDp.getMonth() + 1);
  }
  return novaDp;
}

// Original: alternava classes/textos dos elementos de erro. Devolve as
// mensagens visíveis de cada campo (null = sem erro).
function validateDates(dE, dP, valor, semEntrada, agora) {
  let entrada = null, parcela = null;
  if (!semEntrada) {
    if (!dE) {
      entrada = 'Campo obrigatório';
    } else {
      const _hoje = new Date(agora); _hoje.setHours(0,0,0,0);
      const _max  = new Date(_hoje); _max.setDate(_max.getDate() + 6);
      const _dE   = new Date(dE);   _dE.setHours(0,0,0,0);
      if (_dE > _max) {
        entrada = 'Data máxima: hoje + 6 dias';
      }
    }
  }
  if (!dP) {
    parcela = 'Campo obrigatório';
  } else if (!semEntrada && dE && dP <= dE) {
    parcela = 'Deve ser após a data da entrada';
  }
  return { entrada, parcela };
}

/**
 * Original: atualizar(). Recebe os textos dos campos e devolve o que a tela
 * mostraria: o placeholder, os erros de data, ou as seções com seus cards.
 */
function atualizar({ valorTexto, dataEntradaTexto, dataParcelaTexto, modo, cfg, agora }) {
  reloadCfg(cfg);
  const raw=valorTexto.replace(/\./g,'').replace(',','.');
  const valor=parseFloat(raw);
  const semEntrada = modo !== 'com';
  const fatores = modo === 'sem60' ? FSant60 : FSant;
  const dE=parseBR(dataEntradaTexto), dP=parseBR(dataParcelaTexto);

  if(!valor||valor<=0) return { placeholder: true };
  const erros = validateDates(dE,dP,valor,semEntrada,agora);
  if(erros.entrada || erros.parcela) return { erros };

  const hab = _cfgHab || {};

  const bLabels={1:'À vista',2:'1+1 Boleto',3:'1+2 Boleto',4:'1+3 Boleto',5:'1+4 Boleto',
    6:'1+5 Boleto',7:'1+6 Boleto',8:'1+7 Boleto',9:'1+8 Boleto',10:'1+9 Boleto',11:'1+10 Boleto',12:'1+11 Boleto'};
  const bC=[];
  if(!semEntrada) for(let n=1;n<=12;n++) {
    if(hab.boleto?.[n-1]!==false) bC.push(renderBoleto(valor,n,semEntrada,bLabels[n],dE,dP));
  }

  const sC=[];
  for(let n=1;n<=18;n++) {
    const habKey = !semEntrada ? 'santanderCom' : (modo==='sem60' ? 'santander60' : 'santander30');
    if(hab[habKey]?.[n-1]!==false) sC.push(renderSantander(valor,n,semEntrada,dE,dP,fatores));
  }

  const ops=[
    {label:'Débito',          desc:_cfgCartao[0],  n:1,  hi:0},
    {label:'Crédito à vista', desc:_cfgCartao[1],  n:1,  hi:1},
    {label:'2× Crédito',      desc:_cfgCartao[2],  n:2,  hi:2},
    {label:'3× Crédito',      desc:_cfgCartao[3],  n:3,  hi:3},
    {label:'4× Crédito',      desc:_cfgCartao[4],  n:4,  hi:4},
    {label:'5× Crédito',      desc:_cfgCartao[5],  n:5,  hi:5},
    {label:'6× Crédito',      desc:_cfgCartao[6],  n:6,  hi:6},
    {label:'7× Crédito',      desc:_cfgCartao[7],  n:7,  hi:7},
    {label:'8× Crédito',      desc:_cfgCartao[8],  n:8,  hi:8},
    {label:'9× Crédito',      desc:_cfgCartao[9],  n:9,  hi:9},
    {label:'10× Crédito',     desc:_cfgCartao[10], n:10, hi:10},
    {label:'11× Crédito',     desc:_cfgCartao[11], n:11, hi:11},
    {label:'12× Crédito',     desc:_cfgCartao[12], n:12, hi:12}
  ];
  const cC=[]; for(const o of ops) {
    if(hab.cartao?.[o.hi]!==false) cC.push(renderCartao(valor,o.label,o.desc,o.n,dE,dP));
  }

  // Original: boleto e cartão só eram desenhados quando havia cards de boleto;
  // a seção Santander era sempre desenhada, mesmo vazia.
  return {
    secoes: [
      ...(bC.length ? [{ titulo: 'Boleto · Cheque · Dinheiro', cards: bC }] : []),
      { titulo: 'Financiamento Santander', cards: sC },
      ...(bC.length ? [{ titulo: 'Cartão Visa · Mastercard', cards: cC }] : []),
    ],
  };
}

module.exports = { DEFAULTS, atualizar, parseBR, maskDate, maskValor, dataParcelaParaModo, fmt, fmtData };
