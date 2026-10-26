export type Contato = {
  telefone: string;
  email: string;
  linkedin: string;
  github: string;
  portfolio: string;
  cidade: string;
};

export type ExperienciaPerfil = {
  cargo: string;
  empresa: string;
  periodo: string;
  atividades: string[];
};

export type ProjetoPerfil = { nome: string; descricao: string };
export type Formacao = { curso: string; instituicao: string; periodo: string };

export type Perfil = {
  nome: string;
  contato: Contato;
  sobre: string;
  experiencias: ExperienciaPerfil[];
  projetos: ProjetoPerfil[];
  formacao: Formacao[];
  habilidades: string[];
  idiomas: string[];
  cursos: string[];
  observacoes: string;
};

export type Vaga = { id: string; titulo: string; descricao: string };

export type Curriculo = {
  nome: string;
  contato: Contato;
  titulo: string;
  resumo: string;
  experiencias: { cargo: string; empresa: string; periodo: string; itens: string[] }[];
  projetos: { nome: string; itens: string[] }[];
  formacao: Formacao[];
  habilidades: string[];
  idiomas: string[];
  cursos: string[];
  palavrasChave: string[];
  pendencias: string[];
};

export type ItemChecklist = { regra: string; ok: boolean; detalhe?: string };

export type RespostaGerar = {
  curriculo: Curriculo;
  checklist: ItemChecklist[];
  demo: boolean;
  modelo?: string;
};

/** Vaga coletada pelo vagas-bot (lida do vagas.db dele). */
export type VagaBot = {
  id: string;
  titulo: string;
  empresa: string;
  local: string;
  link: string;
  fonte: string;
  descricao: string;
  data: string;
};

/** Uma vaga que passou pela candidatura automática. */
export type ItemAuto = {
  id: string;
  titulo: string;
  empresa: string;
  link: string;
  fonte: string;
  estado: "gerando" | "fila" | "candidatando" | "ok" | "teste" | "precisa" | "erro" | "ja_feita" | "revisar";
  texto: string;
  ponteId?: string;
  resposta?: RespostaGerar;
  em: string;
};

export type EstadoAuto = {
  ligado: boolean;
  /** Só entram vagas que o vagas-bot viu depois disso (UTC, no formato do SQLite). */
  inicio: string;
  ultimaRodada?: string;
  rodando: boolean;
  itens: ItemAuto[];
};
