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
