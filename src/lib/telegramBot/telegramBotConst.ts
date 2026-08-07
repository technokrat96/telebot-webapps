// Bot Telegram cuma punya satu command: /start. Semua menu lain (Who Am I,
// Register User, Check User, Edit User, Hapus User) dikendalikan lewat
// inline keyboard, bukan slash command.
type COMMAND_TYPE = "start";

const COMMAND_LIST: Record<COMMAND_TYPE, COMMAND_TYPE> = {
  start: "start",
} as const;

// Role yang boleh akses menu Register User / Check User / Edit / Hapus User.
const ADMIN_ROLE = "ADMIN";

export { COMMAND_LIST, ADMIN_ROLE };
