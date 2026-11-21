/* ==========================================================================
   FUEGO AUSTRAL — data.js
   Dados de "La Carta". Conteúdo visível em espanhol do Chile.
   Preços em CLP (inteiros, sem decimais). Para editar o cardápio, altere
   apenas este arquivo: cards, filtros e carrinho se atualizam sozinhos.
   ========================================================================== */
window.FA_DATA = {
  /* Chave do filtro → rótulo visível */
  categories: {
    smash: 'Smash Burgers',
    pizza: 'Pizzas a la Leña',
    completo: 'Completos Chilenos',
  },

  /*
   * art     → ilustração line-art usada no card (burger | pizza | completo)
   * variant → variação da ilustração
   * accent  → cor do brilho no fundo do card
   */
  menu: [
    {
      id: 'austral-double-brasa',
      name: 'Austral Double Brasa',
      category: 'smash',
      price: 10900,
      description: 'Doble smash de carne madurada, cheddar fundido, cebolla caramelizada con merkén, tocino crocante y palta molida en pan brioche.',
      meta: 'Doble carne · 2 × 110 g',
      badge: 'Favorito de la casa',
      art: 'burger',
      variant: 'classic',
      accent: '#E85D04',
    },
    {
      id: 'patagonia-trufada',
      name: 'Patagonia Trufada',
      category: 'smash',
      price: 12500,
      description: 'Doble carne sellada al carbón, queso gruyère, champiñones salteados, mayo de trufa negra y rúcula sobre brioche tostado.',
      meta: 'Doble carne · Trufa negra',
      badge: 'Edición de autor',
      art: 'burger',
      variant: 'truffle',
      accent: '#C98A1E',
    },
    {
      id: 'completo-italiano-autor',
      name: 'Completo Italiano de Autor',
      category: 'completo',
      price: 6900,
      description: 'Pan artesanal, vienesa ahumada, palta fresca, tomate y mayo casera.',
      meta: 'Clásico chileno · 22 cm',
      badge: '',
      art: 'completo',
      variant: 'italiano',
      accent: '#7FA33A',
    },
    {
      id: 'completo-dinamico-austral',
      name: 'Completo Dinámico Austral',
      category: 'completo',
      price: 7500,
      description: 'Vienesa ahumada, palta, tomate, chucrut, salsa americana, salsa verde y mayo casera en pan de masa madre.',
      meta: 'Bien cargado · 22 cm',
      badge: 'Pa’ compartir… o no',
      art: 'completo',
      variant: 'dinamico',
      accent: '#E85D04',
    },
    {
      id: 'pizza-volcan-pepperoni',
      name: 'Pizza Volcán Pepperoni & Miel Picante',
      category: 'pizza',
      price: 14900,
      description: 'Masa madre de 48 h al horno de leña, pomodoro, mozzarella fior di latte, pepperoni crujiente y miel con ají cacho de cabra.',
      meta: 'Horno a leña · 12 porciones',
      badge: 'Picante',
      art: 'pizza',
      variant: 'pepperoni',
      accent: '#D9412B',
    },
    {
      id: 'pizza-cuatro-quesos',
      name: 'Pizza Cuatro Quesos & Cebolla Asada',
      category: 'pizza',
      price: 13900,
      description: 'Mozzarella, gorgonzola, parmesano y queso de cabra, cebolla asada a la brasa y tomillo fresco sobre masa madre de 48 h.',
      meta: 'Horno a leña · Vegetariana',
      badge: '',
      art: 'pizza',
      variant: 'quesos',
      accent: '#F48C06',
    },
  ],
};
