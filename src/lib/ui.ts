/**
 * Surface shared by every form control in the app.
 *
 * Filled, never outlined. With an outline the border is also the focus cue, so a focused
 * field grows a second, darker border and stops looking like the field next to it. A fill
 * that deepens on focus keeps every control visually identical at rest, in the header, the
 * add sheet and the editor, on desktop and on touch.
 */
export const FIELD_CLASS =
  'bg-zinc-100 rounded-lg text-zinc-600 placeholder:text-zinc-400 transition-colors focus:outline-none focus:bg-zinc-200';
