# Tema Shopify da Upy Store

Tema Liquid sem dependências de produção ou etapa de compilação. O catálogo, as variantes, os preços, a sacola e o consentimento de cookies usam os recursos da Shopify.

## Desenvolvimento

Execute Shopify CLI na raiz do projeto:

    shopify theme dev --store upy-store.myshopify.com

A prévia local fica em http://127.0.0.1:9292. Use o tema de desenvolvimento para revisar alterações antes da publicação.

## Organização

- layout/theme.liquid carrega os recursos compartilhados e os arquivos exclusivos da página de produto.
- assets/theme.js cuida do cabeçalho, pesquisa preditiva, favoritos e carregamento dos componentes presentes na página.
- assets/home.js contém os carrosséis e interações das seções da página inicial.
- assets/product-cards.js contém cores, favoritos e adição rápida dos cards usados na página inicial, coleções e busca.
- assets/cart-drawer.js centraliza as alterações da sacola e atualiza o painel com as seções retornadas pela Shopify.
- assets/product-page.js gerencia as variantes, a galeria, o vídeo e os controles de compra.
- assets/recently-viewed.js mantém o histórico local e monta os cards de produtos vistos.
- assets/footer.js integra as preferências de cookies à Customer Privacy API.
- sections/main-page.liquid seleciona os componentes institucionais; seus estilos e scripts ficam nos snippets de FAQ, manifesto, trocas e informações compartilhadas.
- templates/search.json usa os cards compartilhados para os resultados nativos da Shopify.
- Os estilos de cada seção ficam no próprio arquivo Liquid, em stylesheet, para a Shopify incluir apenas os componentes renderizados. Os estilos gerais permanecem em assets/theme.css.

## Comportamentos a preservar

- Até seis fotos da cor selecionada, além do vídeo do produto.
- Vídeo no alto à direita no desktop e em um player pequeno sobre a foto no mobile; reprodução silenciosa e botão para fechar.
- As opções IMG 1 e IMG 2 são auxiliares de mídia e não aparecem como tamanhos de compra.
- Preços e disponibilidade vêm da Shopify; a adição à sacola usa URLs que respeitam o idioma da loja.
- As chaves locais dos favoritos e do histórico permanecem compatíveis com as sessões existentes.
- Alterações no editor de temas inicializam os componentes novos sem duplicar os eventos existentes.

## Verificação

    node scripts/check-theme.mjs
    shopify theme check

O primeiro comando verifica sintaxe JavaScript, JSON, schemas e referências de arquivos. O segundo executa o validador oficial da Shopify. Para alterações visuais, confira as páginas inicial, coleção, busca, produto e políticas em telas de 320, 390, 768 e 1440 pixels.

Imagens estáticas em WebP usam compressão sem perda de pixels visíveis. Evite adicionar bibliotecas, modelos ou arquivos temporários ao diretório do tema.
