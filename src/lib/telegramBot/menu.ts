import { InlineKeyboard, Keyboard } from "grammy";
import { User } from "@/types";
import { ADMIN_ROLE } from "@/lib/telegramBot/telegramBotConst";
import { getAppBaseUrl } from "@/lib/telegramBot/telegramBotUtil";

// Semua callback_data yang dipakai bot. Sengaja dibikin pendek karena
// Telegram membatasi callback_data maksimal 64 byte.
export const CB = {
  MAIN: "m:main",
  WHOAMI: "m:whoami",
  REGISTER: "m:reg",
  CHECK: "m:chk",
  ROLE_TOGGLE_PREFIX: "rt:",
  ROLE_SAVE: "rs",
  ROLE_CANCEL: "rcancel",
  CHECKED_EDIT: "cu:edit",
  CHECKED_DELETE: "cu:delete",
  DELETE_YES: "cu:del:yes",
  DELETE_NO: "cu:del:no",
} as const;

// Berapa username yang ditampilkan sekaligus di daftar Check User (baik
// daftar awal maupun hasil pencarian).
export const CHECK_USER_LIST_SIZE = 5;

export function isAdminRoles(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE);
}

/**
 * Menu utama: Who Am I untuk semua, Register/Check User cuma untuk ADMIN.
 * Tombol "Set Password" cuma muncul kalau user itu belum pernah set
 * password (AppUser.password masih null) -- begitu sudah di-set, tombolnya
 * hilang lagi.
 */
export function buildMainMenuKeyboard(user: User): InlineKeyboard {
  const kb = new InlineKeyboard().text("👤 Who Am I", CB.WHOAMI);
  if (isAdminRoles(user.ROLES)) {
    kb.row()
      .text("➕ Register User", CB.REGISTER)
      .text("🔍 Check User", CB.CHECK);
  }
  if (!user.HAS_PASSWORD) {
    const base = getAppBaseUrl();
    if (base) {
      kb.row().webApp("🔑 Set Password", `${base}/telegram-setup`);
    }
  }
  return kb;
}

/** Checkbox list role dari master data, dipakai Register User & Edit User (mode multi-select). */
export function buildRoleSelectKeyboard(
  allRoles: string[],
  selectedRoles: string[],
): InlineKeyboard {
  const kb = new InlineKeyboard();
  allRoles.forEach((role, idx) => {
    kb.text(
      `${selectedRoles.includes(role) ? "✅" : "⬜"} ${role}`,
      `${CB.ROLE_TOGGLE_PREFIX}${role}`,
    );
    if (idx % 2 === 1) kb.row();
  });
  kb.row().text("💾 Simpan", CB.ROLE_SAVE).text("❌ Batal", CB.ROLE_CANCEL);
  return kb;
}

/** Tombol di bawah hasil Check User: Edit / Hapus / kembali ke menu utama. */
export function buildCheckedUserKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Edit User", CB.CHECKED_EDIT)
    .text("🗑️ Hapus User", CB.CHECKED_DELETE)
    .row()
    .text("🔙 Menu Utama", CB.MAIN);
}

export function buildConfirmDeleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Ya, Hapus", CB.DELETE_YES)
    .text("❌ Batal", CB.DELETE_NO);
}

export function buildBackToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("🔙 Menu Utama", CB.MAIN);
}

/**
 * Custom keyboard (bukan inline) berisi username yang bisa di-tap. Tap
 * langsung mengisi kotak input chat dengan username itu (mirip
 * copy-paste), lalu tinggal di-kirim -- lebih gampang daripada ngetik
 * ulang manual. `oneTime()` bikin keyboard-nya otomatis hilang lagi begitu
 * dipakai/pesan berikutnya terkirim.
 */
export function buildUsernameListKeyboard(usernames: string[]): Keyboard {
  const kb = new Keyboard();
  usernames.forEach((username, idx) => {
    kb.text(username);
    if (idx % 2 === 1) kb.row();
  });
  return kb.resized().oneTime();
}

/** Teks daftar username untuk Check User, sekaligus info kalau hasilnya dipotong. */
export function formatUsernameListMessage(
  items: { username: string; name: string }[],
  total: number,
): string {
  if (items.length === 0) {
    return "Tidak ada user yang cocok.";
  }
  const list = items
    .map((u) => `<code>${u.username}</code>${u.name ? ` - ${u.name}` : ""}`)
    .join("\n");
  const info =
    total > items.length
      ? `\n\nMenampilkan ${items.length} dari ${total} user. Ketik sebagian username untuk mempersempit pencarian, atau tap salah satu di bawah.`
      : `\n\nTap salah satu di bawah, atau ketik sebagian username untuk mencari.`;
  return `${list}${info}`;
}

export function formatUserCard(
  user: User,
  heading = "Berikut data user yang ditemukan",
): string {
  const { USERNAME, NAME, ROLES } = user;
  return (
    `${heading}:\n\n` +
    `👤 <b>Nama:</b> ${NAME || "-"}\n` +
    `🏷️ <b>Username:</b> @${USERNAME}\n` +
    `💼 <b>Role:</b> <i>${ROLES.join(", ") || "-"}</i>`
  );
}
