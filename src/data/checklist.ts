import type { ChecklistItem } from '../types';

/**
 * Lista oficial dos 29 itens.
 * Para mudar a exigência de fotos, altere `minPhotos`.
 * Para dispensar fotos quando o item for NA, adicione `naExemptsPhotos: true` ao item.
 */
export const CHECKLIST: ChecklistItem[] = [
  { id: 1, description: 'Cinto de segurança para todos os ocupantes', minPhotos: 1 },
  { id: 2, description: 'Bancos dos passageiros em condições de uso', minPhotos: 1 },
  { id: 3, description: 'Saídas de emergência', minPhotos: 1 },
  { id: 4, description: 'Placas de advertência (proibido falar com o motorista com o equipamento em movimento)', minPhotos: 1 },
  { id: 5, description: 'Cabine fechada e climatizada', minPhotos: 1 },
  { id: 6, description: 'Escadas de acesso ao equipamento com antiderrapante e corrimão', minPhotos: 1 },
  { id: 7, description: 'Campo de visão do motorista e para-brisa em condições de uso', minPhotos: 1 },
  { id: 8, description: 'Limpador e esguicho em condições de uso', minPhotos: 1 },
  { id: 9, description: 'Adesivo de altura do equipamento interno e externo', minPhotos: 1 },
  { id: 10, description: 'Buzina em funcionamento', minPhotos: 0 },
  { id: 11, description: 'Retrovisores externos, mínimo de 2', minPhotos: 2 },
  { id: 12, description: 'Giroflex', minPhotos: 1 },
  { id: 13, description: 'Extintor de incêndio com carga de pó ABC', minPhotos: 1 },
  { id: 14, description: 'Sistema hidráulico e sistema de combustível sem vazamentos', minPhotos: 0 },
  { id: 15, description: 'Tacógrafo', minPhotos: 1 },
  { id: 16, description: 'Painel de instrumentos funcionando corretamente', minPhotos: 1 },
  { id: 17, description: 'Bafômetro funcionando corretamente', minPhotos: 1 },
  { id: 18, description: 'Cópia do CRLV', minPhotos: 1 },
  { id: 19, description: 'Cópia da ATF', minPhotos: 1 },
  { id: 20, description: 'Selo de fumaça preta', minPhotos: 1 },
  { id: 21, description: 'Logomarca da empresa', minPhotos: 1 },
  { id: 22, description: 'Adesivos refletivos', minPhotos: 2 },
  { id: 23, description: 'Faróis dianteiros (alto, baixo, setas)', minPhotos: 3 },
  { id: 24, description: 'Faróis traseiros (lanternas traseiras, setas traseiras, luz e sirene de ré)', minPhotos: 3 },
  { id: 25, description: 'Condições dos pneus', minPhotos: 4 },
  { id: 26, description: 'Dips de roda', minPhotos: 4 },
  { id: 27, description: 'Calços de roda', minPhotos: 1 },
  { id: 28, description: 'Três coletes', minPhotos: 1 },
  { id: 29, description: 'Três cones', minPhotos: 1 },
];

export const getItem = (id: number) => CHECKLIST.find((i) => i.id === id);
