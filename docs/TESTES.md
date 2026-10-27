# Roteiro de testes

## Automatizados (`npm test`)
| Arquivo | O que cobre |
|---|---|
| `logic.test.ts` | 29 itens e fotos mínimas, NA não dispensa foto, estados do item, resumo, nome do PDF |
| `db.test.ts` | **Teste 1** cadastro e duplicidade, **Testes 2 e 3** vistorias simultâneas e persistência após fechar o banco, isolamento entre vistorias, **Teste 4** itens de 1/2/3/4 fotos, **Teste 5** conclusão bloqueada e liberada, reabertura |
| `pdf.test.ts` | **Teste 6** (parte técnica): PDF com todas as fotos, paginação, vistoria sem fotos, fotos de outra vistoria ignoradas. Gera `relatorio-teste.pdf` na pasta temporária do sistema para conferência visual |

## Manuais (precisam de celular e do site publicado)
**Teste 6 - conferência visual do PDF**: abra um PDF real e confirme que cada foto está ao lado do item certo, que itens com 3 e 4 fotos aparecem inteiros, que o item 10 e o 14 (sem foto) não dão erro e que o arquivo abre em outro aparelho.

**Teste 7 - compartilhamento**: em *Relatório* toque em *Compartilhar PDF*, escolha o WhatsApp e confirme que o arquivo recebido tem as fotos. Em navegador sem suporte, o app orienta a baixar e anexar manualmente.

**Teste 8 - publicação**: abra o link da Netlify por HTTPS, instale na tela inicial (Android e iPhone), ative o modo avião e abra o app (deve carregar offline), tire fotos pela câmera e conclua uma vistoria.

**Câmera**: no item, *Tirar foto* deve abrir a câmera traseira; *Galeria* deve permitir escolher várias imagens. Fotos tiradas com o celular na vertical devem aparecer na orientação correta.

## Não executado no ambiente de desenvolvimento
Câmera real, Web Share no celular, instalação do PWA e funcionamento offline em aparelho real não podem ser executados aqui. Use o roteiro acima.

**Comprovação de manutenção**: marque um item como NC, anexe a comprovação, conclua a vistoria, abra o relatório, anexe outra comprovação e use *Gerar nova versão do PDF*. Confira a seção final do PDF.
