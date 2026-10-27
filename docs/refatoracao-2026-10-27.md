# Revisão do tema — 27 de outubro de 2026

Base da comparação: commit eb64332. Trabalho no branch codex/theme-performance-mobile.

## Medidas

Tamanhos dos arquivos locais, sem compressão de transporte:

| Recurso | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| JavaScript compartilhado, theme.js | 39.906 bytes | 18.244 bytes | 54% |
| CSS global, theme.css | 90.039 bytes | 55.070 bytes | 39% |
| Quatro imagens estáticas | 2.569.732 bytes | 1.807.542 bytes | 30% |

Os scripts de carrosséis e cards foram separados e são solicitados quando a página contém esses componentes. Os estilos específicos foram movidos para os arquivos Liquid que os utilizam, aproveitando o recorte de CSS da Shopify. A redução dos arquivos globais não significa remoção dos componentes: cada página continua recebendo os estilos e scripts necessários.

As imagens WebP mantêm os mesmos pixels visíveis dos PNGs anteriores. As tabelas preservam a resolução de 1254 × 1254.

## Organização e carregamento

- Cabeçalho, favoritos e pesquisa permanecem em theme.js; home.js e product-cards.js são carregados conforme o conteúdo renderizado.
- A pesquisa preditiva usa um cache limitado a 12 termos por até 30 segundos, cancela consultas abandonadas, formata preços na moeda da loja e aceita navegação pelas setas do teclado.
- A tela de resultados da busca ganhou um template próprio, com cards compartilhados e paginação nativa da Shopify.
- A galeria calcula o vínculo entre cores e mídias uma vez. Mantém até seis fotos da cor, além do vídeo, e preserva a foto ativa ao mudar a quantidade ou adicionar à sacola.
- O vídeo flutuante fica fora da navegação das fotos no mobile. Seu fechamento pausa a reprodução. No desktop, o vídeo principal ocupa a primeira linha da segunda coluna.
- A adição à sacola reaproveita a renderização de seções da Shopify; as adições são ordenadas para reduzir conflitos entre respostas.
- Produtos vistos recentemente usam consultas compartilhadas, limitadas à quantidade necessária e adiadas até a seção se aproximar da tela.
- Recomendações e Sizebay são carregados quando suas áreas se aproximam da tela. O banner principal pausa seu temporizador fora da área visível.
- Manifesto, FAQ, trocas e informações compartilhadas possuem componentes próprios, com estilos e scripts associados ao conteúdo.
- Foram removidas 25 substituições repetidas de tradução, preservando os textos das 23 chaves envolvidas.
- A tabela de medidas passou a usar uma imagem HTML com dimensões explícitas; a combinação anterior de asset_url com image_tag produzia erro de Liquid.

## Verificações realizadas

- Validação Shopify de todos os 49 arquivos Liquid, JSON, JavaScript e CSS do tema.
- Theme Check oficial executado com nível de falha em erro: nenhum apontamento retornado.
- Verificação estrutural local de 47 arquivos: sintaxe de JavaScript, inclusive blocos javascript de Liquid, JSON, schemas, referências de assets, snippets e tipos de seção.
- Comparação de 1.088 regras CSS anteriores com a versão reorganizada: nenhuma regra perdida pela migração. As cinco regras modificadas correspondem aos ajustes intencionais do vídeo mobile, larguras mínimas, resultados da busca e quebra de linha das cores.
- Página inicial, coleção, busca e cookies conferidos em 320, 390, 768 e 1440 pixels. FAQ, manifesto, frete e trocas também foram conferidos em 390 pixels. A revisão corrigiu a rolagem horizontal observada nas larguras menores.
- Quatro cores do produto de referência conferidas: todas as fotos visíveis pertenciam às variantes da cor selecionada.
- Navegação repetida pelas fotos sem parar no vídeo flutuante ou deixar a galeria vazia.
- Adição e remoção na sacola tanto pelo produto quanto pelo card. A foto ativa e a cor escolhida foram preservadas, confirmando a atualização sem recarga completa. Os itens de teste foram removidos.
- Ordenação da coleção por menor preço, pesquisa preditiva, foco pelo teclado, menu mobile, abertura de preferências de cookies, favoritos, filtro e acordeão do FAQ conferidos.
- Imagens das tabelas carregadas corretamente em WebP; vídeo principal posicionado no desktop e fechado com pausa no mobile.

A revisão foi feita na prévia de desenvolvimento Shopify, no navegador Chromium disponível. Pagamentos reais, envio do formulário de atendimento e navegadores de dispositivos físicos não fizeram parte dos testes. As medidas acima são de arquivos e comportamento, não uma pontuação Lighthouse nem uma promessa de tempo de carregamento.

## Como conferir novamente

    node scripts/check-theme.mjs
    shopify theme check
    shopify theme dev --store upy-store.myshopify.com
