# Auditoria — Fuego Austral

**Data:** 2026-11-21 · **Ambiente:** `http://127.0.0.1:5173` (servidor local, sem limitação de rede)
**Navegador:** Chrome desktop (viewport 1745×814 CSS, DPR 1.1) + iframe 390×780 para mobile
**Modo:** auditoria com correção. Toda correção foi retestada no navegador.

## Resumo

- **Bloqueadores:** nenhum. O fluxo principal funciona: hero → La Carta → filtro → "+ Agregar" →
  carrinho (soma em CLP) → confirmação.
- **Corrigidos:** 14 achados (1 de prioridade alta, 5 médios, 8 baixos).
- **Publicação:** GitHub Pages com `og:image` absoluto e `canonical` configurados.
- **Não testado:** Safari/iOS, Firefox, aparelho real, leitor de tela, Lighthouse.

## Achados corrigidos

| # | Prioridade | Achado | Evidência | Correção | Reteste |
|---|---|---|---|---|---|
| 1 | Alta | Cliques rápidos nos filtros deixavam um card invisível ocupando uma célula do grid | Sequência smash→pizza→completo→all→completo: cards nas colunas 1 e 3, buraco na 2 | Termina o Flip anterior e limpa estilos inline antes do próximo | 3 sequências rápidas: estado final certo, cards nas colunas 1-2, opacidade 1 |
| 2 | Média | Reload abria no meio do hero (o navegador restaurava o scroll) | `scrollY` 5625 após reload | `scrollRestoration = 'manual'` no `<head>` + reset no boot | `scrollY` 0, frame 001 |
| 3 | Média | Tailwind Play CDN: 451 KB de JS compilando CSS no navegador + aviso no console | Download medido com `curl` | CSS compilado `css/tailwind.css` (7 KB) | Sem requisição ao CDN; console sem mensagens |
| 4 | Média | Celular baixava 8,7 MB de frames 1920px | Soma em disco | Frames 1280px para telas < 768px + DPR limitado a 1.5 | Mobile: 4,44 MB transferidos (Resource Timing), sem erros |
| 5 | Média | Texto `--faint` com contraste ≈ 3,7:1 (abaixo de 4,5:1 AA) | Cálculo: rgba(242,237,228,.42) sobre #0A0A0B | Opacidade 0,55 → ≈ 5,6:1 | Variável aplicada (computed style) |
| 6 | Média | Header escondido no scroll continuava escondido com foco de teclado dentro | `transform: translateY(-76px)` com foco no carrinho | `.site-header:focus-within { transform: none }` | Com foco: `transform: none` |
| 7 | Baixa | Links de redes com `href="#"` pulavam para o topo do hero | Âncora nativa | Viraram texto `@fuegoaustral` (comentário no HTML para trocar) | — |
| 8 | Baixa | Loader com `aria-live` anunciaria cada % do progresso | Marcação | Loader `aria-hidden` (decorativo) | — |
| 9 | Baixa | `role="toolbar"` nos filtros sem navegação por setas | Marcação | `role="group"` | — |
| 10 | Baixa | Footer continuava acessível por trás do menu e do carrinho | `inert` só no `<main>` | `inert` também no footer | Menu e carrinho: main/footer/header inertes; Esc restaura |
| 11 | Baixa | Alvo do skip link não recebia foco | `<main>` sem tabindex | `tabindex="-1"` | 1º Tab = skip link |
| 12 | Baixa | "+" do carrinho falhava em silêncio no limite de 20 | — | Botão desabilitado no máximo | — |
| 13 | Baixa | Peso de marca: favicon 66 KB, logo do footer 349 KB | Disco | Favicon 32px 3,5 KB · logo 169 KB · emblema 66 KB · OG 1200×630 54 KB | Sem 404 |
| 14 | Baixa | Texto "Total pagado en caja" antes do pagamento | Tela de confirmação | "Total a pagar en caja" | Visual |

## Verificado sem achados

- Hero: 3 blocos de texto nos trechos 0–25%, 35–60% e 70–95%; contador e barra de progresso.
- Carrinho: soma (2 × $14.900 = $29.800), persistência após reload (localStorage), foco no
  "Cerrar" ao abrir, Esc fecha, foco volta ao botão de origem.
- Menu móvel: abre, trava o scroll, fecha ao abrir o carrinho.
- Movimento reduzido (`prefers-reduced-motion` simulado): sem Lenis, conteúdo visível sem
  animação, contadores no valor final, scrub do hero funcional.
- 390px: sem rolagem horizontal; carrinho ocupa a tela inteira.
- SEO básico: `lang="es-CL"`, title, description, um `h1`, `h2` por seção, Open Graph + Twitter card.

## Pendências e hipóteses

| Item | Status | Impacto | Ação |
|---|---|---|---|
| Memória no iOS com 94 frames decodificados | Hipótese | Aba pode recarregar em iPhones antigos | Já reduzido com frames 1280px; testar em aparelho |
| Desempenho em rede móvel real | Não medido | 4,4 MB de frames no celular | Medir com Lighthouse/WebPageTest após publicar |
| Safari, Firefox, leitor de tela | Não testado | Desconhecido | Testar antes de entregar a cliente |
| Dados de exemplo (telefone 5555, e-mail, redes) | Intencional | Marca fictícia | Substituir se virar marca real |

## Revisão mobile — 2026-11-21

**Ambiente:** Playwright 1.65 · Chrome (Pixel 7 / iPhone 13 emulados, toque real via CDP) + WebKit 26
(motor do Safari) em retrato e paisagem (iPhone SE, iPhone 13, iPhone 13 Pro Max, Pixel 7).

| # | Prioridade | Achado | Correção | Reteste |
|---|---|---|---|---|
| 15 | Alta | Dois toques rápidos no ☰ deixavam o menu invisível com a página travada | Animação anterior cancelada antes da próxima (`anim.kill()`), títulos com `fromTo` | Abrir/fechar/abrir em 150 ms: menu visível, links no lugar (Chrome e WebKit) |
| 16 | Alta | Barra de endereço do celular sumindo disparava `ScrollTrigger.refresh()` → o hambúrguer pulava de frame | `resize` só recalcula quando a **largura** muda | Altura +60 px: frame 057 → 057 (antes 057 → 052) |
| 17 | Média | Celular deitado: título do hero subia por cima do logo; menu cortava "Pedir Ahora" | Tipografia do hero proporcional à altura (`vh`) + menu com rolagem própria | Kicker sempre abaixo do header nos 4 aparelhos; menu rola |
| 18 | Média | `:hover` "grudava" após o toque (botão laranja, card levantado); toque duplo no "+" dava zoom no iPhone | Hover só em `@media (hover: hover)`, `touch-action: manipulation`, feedback em `:active` | 2 toques rápidos no "+": qty 1 → 3, sem zoom |
| 19 | Média | Filtro "Completos Chilenos" ficava cortado na borda | Filtro escolhido é centralizado na barra | Pílula alinhada ao botão, botão inteiro visível |
| 20 | Baixa | Arrastar no carrinho/menu podia rolar a página de fundo | `overscroll-behavior: contain` + `touch-action: none` no fundo escuro | Toque real: página parada, lista do carrinho rola |
| 21 | Baixa | iPhone com notch/home indicator (`viewport-fit=cover`) | `env(safe-area-inset-*)` no gutter, rodapé, carrinho e menu | — (sem aparelho físico) |
| 22 | Baixa | Safari < 16.2 descartava o fundo dos cards (`color-mix`) | Fundo de fallback antes | — |

Desktop (1440×900) retestado sem regressão: hover dos cards/botões/filtros, filtro, carrinho, resize.
