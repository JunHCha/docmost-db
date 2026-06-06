// Isolates calendar bar DnD from the page tree and other adapters, so a bar drag
// can never be picked up by an unrelated drop target (canDrop checks this
// symbol). Mirrors BOARD_CARD_DRAG in board-view/board-dnd.
export const CALENDAR_BAR_DRAG = Symbol("database-calendar-bar");
