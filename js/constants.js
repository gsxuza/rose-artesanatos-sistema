// ════════════════════════════════════════════════════════════
// Rose Artesanatos · constants.js
// Única fonte de verdade para valores fixos do sistema
// ════════════════════════════════════════════════════════════

const STATUS_FLOW = ['pendente', 'separando', 'embalado', 'despachado'];

const STATUS_BADGES = {
  pendente:   ['badge-amber',  'Pendente'],
  separando:  ['badge-blue',   'Separando'],
  embalado:   ['badge-green',  'Embalado'],
  despachado: ['badge-purple', 'Despachado'],
  pago:       ['badge-green',  'Pago'],
  pendpag:    ['badge-amber',  'Pendente'],
  ok:         ['badge-green',  'OK'],
  baixo:      ['badge-amber',  'Baixo'],
  critico:    ['badge-red',    'Crítico'],
};

const SECTION_TITLES = {
  dashboard:     'Dashboard',
  pedidos:       'Pedidos',
  despacho:      'Despacho',
  estoque:       'Estoque',
  financeiro:    'Financeiro',
  equipe:        'Equipe',
  configuracoes: 'Configurações',
};

const TEAM = [
  { n: 'Fábio',  r: 'Gestor Geral',        ini: 'F',  c: 'var(--accent)',
    tasks: ['Supervisão geral da operação', 'Gestão de e-commerce', 'Financeiro e administrativo', 'Suporte à equipe'] },
  { n: 'Roseli', r: 'Gestora Geral',        ini: 'R',  c: 'var(--accent)',
    tasks: ['Supervisão presencial', 'Gestão de produção', 'Expedição', 'Alinhamento de processos'] },
  { n: 'Yasmin', r: 'Fiscal & Embalagem',   ini: 'Y',  c: 'var(--blue-500)',
    tasks: ['Emitir NFs e etiquetas do dia', 'Imprimir relação de Envios Full', 'Conferir pedidos embalados vs sistema', 'Registrar horários de corte e despacho'] },
  { n: 'Daniel', r: 'Separação & Despacho', ini: 'D',  c: 'var(--green-500)',
    tasks: ['Separar produtos dos pedidos do dia', 'Informar quantidade embalados à Yasmin', 'Embalar pedidos', 'Levar pedidos ao despacho (com Luiz)'] },
  { n: 'Luiz',   r: 'Apoio & Despacho',     ini: 'L',  c: 'var(--amber-500)',
    tasks: ['Apoiar Daniel na separação', 'Iniciar embalagem durante impressão', 'Levar pedidos ao despacho (com Daniel)'] },
  { n: 'Lucas',  r: 'Operador de Máquinas', ini: 'Lc', c: '#7040A0',
    tasks: ['Operar 2 máquinas de corte MDF', 'Destacar produtos para expedição', 'Apoio em demandas operacionais'] },
];
