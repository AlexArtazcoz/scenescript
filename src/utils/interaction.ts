/* Detecció d'entrada del dispositiu.
 *
 * Tots els controls "que apareixen en passar-hi per sobre" depenen del hover,
 * que en pantalles tàctils (iPad, mòbil) no existeix: quedaven invisibles i
 * l'app semblava capada. En dispositius sense hover els mostrem sempre.
 *
 * Constant de mòdul i no un hook: la classe de dispositiu no canvia durant la
 * sessió (i si un iPad connecta un ratolí, un refresc ho recull).
 */
export const DEVICE_HAS_HOVER =
  typeof window === 'undefined' || window.matchMedia('(hover: hover)').matches;
