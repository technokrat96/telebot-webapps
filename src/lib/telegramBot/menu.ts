import {InlineKeyboard} from "grammy";
import {User} from "@/types";
import {ADMIN_ROLE} from "@/lib/telegramBot/telegramBotConst";

// Semua callback_data yang dipakai bot. Sengaja dibikin pendek karena
// Telegram membatasi callback_data maksimal 64 byte.
export const CB = {
  MAIN: 'm:main',
  WHOAMI: 'm:whoami',
  REGISTER: 'm:reg',
  CHECK: 'm:chk',
  ROLE_TOGGLE_PREFIX: 'rt:',
  ROLE_SAVE: 'rs',
  ROLE_CANCEL: 'rcancel',
  CHECKED_EDIT: 'cu:edit',
  CHECKED_DELETE: 'cu:delete',
  DELETE_YES: 'cu:del:yes',
  DELETE_NO: 'cu:del:no',
} as const;

export function isAdminRoles(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE);
}

/** Menu utama: Who Am I untuk semua, Register/Check User cuma untuk ADMIN. */
export function buildMainMenuKeyboard(roles: string[]): InlineKeyboard {
  const kb = new InlineKeyboard().text('👤 Who Am I', CB.WHOAMI);
  if (isAdminRoles(roles)) {
    kb.row()
      .text('➕ Register User', CB.REGISTER)
      .text('🔍 Check User', CB.CHECK);
  }
  return kb;
}

/** Checkbox list role dari master data, dipakai Register User & Edit User (mode multi-select). */
export function buildRoleSelectKeyboard(allRoles: string[], selectedRoles: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  allRoles.forEach((role, idx) => {
    kb.text(`${selectedRoles.includes(role) ? '✅' : '⬜'} ${role}`, `${CB.ROLE_TOGGLE_PREFIX}${role}`);
    if (idx % 2 === 1) kb.row();
  });
  kb.row()
    .text('💾 Simpan', CB.ROLE_SAVE)
    .text('❌ Batal', CB.ROLE_CANCEL);
  return kb;
}

/** Tombol di bawah hasil Check User: Edit / Hapus / kembali ke menu utama. */
export function buildCheckedUserKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✏️ Edit User', CB.CHECKED_EDIT)
    .text('🗑️ Hapus User', CB.CHECKED_DELETE)
    .row()
    .text('🔙 Menu Utama', CB.MAIN);
}

export function buildConfirmDeleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Ya, Hapus', CB.DELETE_YES)
    .text('❌ Batal', CB.DELETE_NO);
}

export function buildBackToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🔙 Menu Utama', CB.MAIN);
}

export function formatUserCard(user: User, heading = 'Berikut data user yang ditemukan'): string {
  const {USERNAME, NAME, ROLES} = user;
  return (
    `${heading}:\n\n` +
    `👤 <b>Nama:</b> ${NAME || '-'}\n` +
    `🏷️ <b>Username:</b> @${USERNAME}\n` +
    `💼 <b>Role:</b> <i>${ROLES.join(', ') || '-'}</i>`
  );
}
