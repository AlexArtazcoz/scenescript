// Shared animation timing constant used by column transition styles.
export const ABOUT_SPEED = 0.5;

/* Amplades de columna — única font de veritat (abans duplicades a Storyboard
   i SceneCard, amb el mateix 324 hardcodejat també al CSS).

   En pantalles petites la columna s'encaixa al que queda de viewport: barra
   esquerra (72px sota els 640px d'amplada, 110 altrament) més un marge perquè
   la vora dreta — on viu el disparador d'inserir columnes — quedi dins la
   pantalla. Es calcula un cop per càrrega: girar el mòbil demana un refresc.
   main.tsx propaga aquests valors a --column-width/--column-width-reading. */
/* Cap mòbil real fa menys de 330px: una amplada menor és un viewport encara
   sense assentar (p. ex. una WebView arrencant) i es tracta com a escriptori. */
const VIEWPORT_W =
  typeof window === 'undefined' || window.innerWidth < 330 ? 1280 : window.innerWidth;
const LEFTBAR_W = VIEWPORT_W <= 640 ? 72 : 110;

export const COL_W = Math.min(324, Math.max(230, VIEWPORT_W - LEFTBAR_W - 24));
export const COL_W_READING = Math.min(437, Math.max(230, VIEWPORT_W - LEFTBAR_W - 24));
