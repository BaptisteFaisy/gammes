/**
 * Gammes — site public : types partagés entre les écrans.
 * Un seul fichier, pour éviter que les panneaux s'importent entre eux en cercle.
 */

/** Redessine l'écran courant (après une action qui a changé l'état). */
export type Rerender = () => void;
