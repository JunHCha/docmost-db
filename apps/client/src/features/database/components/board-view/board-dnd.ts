// Isolates board card DnD from the page tree and column-reorder adapters, so a
// card drag can never be picked up by an unrelated drop target (canDrop checks
// this symbol). Mirrors the COLUMN_DRAG pattern in table-view/column-header.
export const BOARD_CARD_DRAG = Symbol("database-board-card");
