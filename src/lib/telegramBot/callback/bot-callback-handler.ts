import {Context, InlineKeyboard} from "grammy";
import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";
import {clearBotSession, getBotSession, setBotSession} from "@/lib/db/botSession";
import {getMasterData} from "@/lib/db/masterData";
import {
  deleteUserByUsername,
  findUserByUsername,
  insertUser,
  replaceUserRoles,
} from "@/lib/db/users";
import {ADMIN_ROLE} from "@/lib/telegramBot/telegramBotConst";
import {
  buildBackToMenuKeyboard,
  buildCheckedUserKeyboard,
  buildConfirmDeleteKeyboard,
  buildMainMenuKeyboard,
  buildRoleSelectKeyboard,
  CB,
  formatUserCard,
} from "@/lib/telegramBot/menu";

type ParsedInfo = Awaited<ReturnType<typeof parseDataTelegram>>;

/**
 * Router utama untuk semua klik inline button. Setiap handler DIJAMIN cuma
 * manggil `ctx.answerCallbackQuery` tepat satu kali per klik -- kalau
 * dipanggil lebih dari sekali Telegram API akan error (query sudah
 * dijawab). Kalau ada error yang di-throw sebelum handler sempat manggil
 * `answerCallbackQuery`, catch di paling bawah yang bertanggung jawab
 * menjawabnya (lewat alert).
 */
export async function botCallbackHandler(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;

  try {
    const info = await parseDataTelegram(ctx);
    if (!info.chatId) {
      await ctx.answerCallbackQuery();
      return;
    }
    const chatId = info.chatId;

    if (data === CB.MAIN) return await handleMain(ctx, info);
    if (data === CB.WHOAMI) return await handleWhoAmI(ctx, info);
    if (data === CB.REGISTER) return await handleRegisterStart(ctx, info);
    if (data === CB.CHECK) return await handleCheckStart(ctx, info);
    if (data.startsWith(CB.ROLE_TOGGLE_PREFIX)) {
      return await handleRoleToggle(ctx, chatId, data.slice(CB.ROLE_TOGGLE_PREFIX.length));
    }
    if (data === CB.ROLE_SAVE) return await handleRoleSave(ctx, info);
    if (data === CB.ROLE_CANCEL) return await handleRoleCancel(ctx, info);
    if (data === CB.CHECKED_EDIT) return await handleCheckedEdit(ctx, info);
    if (data === CB.CHECKED_DELETE) return await handleCheckedDelete(ctx, info);
    if (data === CB.DELETE_YES) return await handleDeleteYes(ctx, info);
    if (data === CB.DELETE_NO) return await handleDeleteNo(ctx, chatId);

    // callback_data tidak dikenali (misal tombol lama dari deploy sebelumnya).
    await ctx.answerCallbackQuery();
  } catch (e) {
    const raw = e instanceof Error ? e.message : (typeof e === "string" ? e : "Terjadi kesalahan.");
    const plain = raw.replace(/<[^>]+>/g, "").slice(0, 200);
    try {
      await ctx.answerCallbackQuery({text: plain, show_alert: true});
    } catch {
      // Query mungkin sudah kedaluwarsa/terjawab -- tidak banyak yang bisa
      // dilakukan lagi, biarkan saja.
    }
  }
}

async function safeEditMessageText(
  ctx: Context,
  text: string,
  other?: {parse_mode?: "HTML"; reply_markup?: InlineKeyboard},
) {
  try {
    await ctx.editMessageText(text, other);
  } catch (e) {
    if (!isNotModifiedError(e)) throw e;
  }
}

async function safeEditMessageReplyMarkup(ctx: Context, keyboard: InlineKeyboard) {
  try {
    await ctx.editMessageReplyMarkup({reply_markup: keyboard});
  } catch (e) {
    if (!isNotModifiedError(e)) throw e;
  }
}

function isNotModifiedError(e: unknown): boolean {
  const description = (e as {description?: string})?.description ?? (e instanceof Error ? e.message : "");
  return description.includes("message is not modified");
}

function isAdmin(roles: string[]): boolean {
  return roles.includes(ADMIN_ROLE);
}

async function handleMain(ctx: Context, info: ParsedInfo) {
  const user = await validateUser(ctx, info);
  await clearBotSession(info.chatId!);
  await ctx.answerCallbackQuery();
  await safeEditMessageText(
    ctx,
    `Halo <b>${user.NAME || "Pengguna"}</b>! Silakan pilih menu di bawah ini:`,
    {parse_mode: "HTML", reply_markup: buildMainMenuKeyboard(user.ROLES)},
  );
}

async function handleWhoAmI(ctx: Context, info: ParsedInfo) {
  const user = await validateUser(ctx, info);
  await clearBotSession(info.chatId!);
  await ctx.answerCallbackQuery();
  await safeEditMessageText(
    ctx,
    formatUserCard(user, "Berikut data Anda yang terdaftar di sistem"),
    {parse_mode: "HTML", reply_markup: buildBackToMenuKeyboard()},
  );
}

async function handleRegisterStart(ctx: Context, info: ParsedInfo) {
  const adminUser = await validateUser(ctx, info);
  if (!isAdmin(adminUser.ROLES)) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak memiliki akses untuk menu ini.", show_alert: true});
    return;
  }
  await setBotSession(info.chatId!, "AWAIT_REG_USERNAME");
  await ctx.answerCallbackQuery();
  await safeEditMessageText(
    ctx,
    "➕ <b>Register User</b>\n\nKetik username Telegram yang ingin didaftarkan (tanpa @):",
    {parse_mode: "HTML", reply_markup: buildBackToMenuKeyboard()},
  );
}

async function handleCheckStart(ctx: Context, info: ParsedInfo) {
  const adminUser = await validateUser(ctx, info);
  if (!isAdmin(adminUser.ROLES)) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak memiliki akses untuk menu ini.", show_alert: true});
    return;
  }
  await setBotSession(info.chatId!, "AWAIT_CHK_USERNAME");
  await ctx.answerCallbackQuery();
  await safeEditMessageText(
    ctx,
    "🔍 <b>Check User</b>\n\nKetik username yang ingin dicek:",
    {parse_mode: "HTML", reply_markup: buildBackToMenuKeyboard()},
  );
}

async function handleRoleToggle(ctx: Context, chatId: string, role: string) {
  const session = await getBotSession(chatId);
  if (!session || (session.state !== "SELECT_REG_ROLES" && session.state !== "SELECT_EDIT_ROLES")) {
    await ctx.answerCallbackQuery({text: "Sesi sudah kedaluwarsa. Ketik /start untuk mulai lagi.", show_alert: true});
    return;
  }
  const currentRoles = session.data.roles ?? [];
  const nextRoles = currentRoles.includes(role)
    ? currentRoles.filter((r) => r !== role)
    : [...currentRoles, role];
  await setBotSession(chatId, session.state, {...session.data, roles: nextRoles});
  await ctx.answerCallbackQuery();
  const {ROLES: allRoles} = await getMasterData();
  await safeEditMessageReplyMarkup(ctx, buildRoleSelectKeyboard(allRoles, nextRoles));
}

async function handleRoleSave(ctx: Context, info: ParsedInfo) {
  const chatId = info.chatId!;
  const session = await getBotSession(chatId);
  if (
    !session ||
    (session.state !== "SELECT_REG_ROLES" && session.state !== "SELECT_EDIT_ROLES") ||
    !session.data.username
  ) {
    await ctx.answerCallbackQuery({text: "Sesi sudah kedaluwarsa. Ketik /start untuk mulai lagi.", show_alert: true});
    return;
  }

  const selectedRoles = session.data.roles ?? [];
  if (selectedRoles.length === 0) {
    await ctx.answerCallbackQuery({text: "⚠️ Pilih minimal satu role terlebih dahulu.", show_alert: true});
    return;
  }

  const adminUser = await validateUser(ctx, info);
  if (!isAdmin(adminUser.ROLES)) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak memiliki akses.", show_alert: true});
    return;
  }

  const targetUsername = session.data.username;
  let targetUser = await findUserByUsername(targetUsername);
  if (!targetUser) {
    targetUser = await insertUser({username: targetUsername, name: "", chatId: null, telegramId: null});
  }

  await replaceUserRoles(targetUser.USERNAME, selectedRoles);

  const isRegister = session.state === "SELECT_REG_ROLES";
  await clearBotSession(chatId);
  await ctx.answerCallbackQuery({text: "✅ Berhasil disimpan."});

  await safeEditMessageText(
    ctx,
    `✅ <b>Berhasil.</b>\nRole user <b>@${targetUser.USERNAME}</b> ${isRegister ? "didaftarkan" : "diperbarui"} menjadi: <i>${selectedRoles.join(", ")}</i>.`,
    {parse_mode: "HTML", reply_markup: buildBackToMenuKeyboard()},
  );

  const targetChatId = targetUser.CHAT_ID ?? targetUser.TELEGRAM_ID;
  if (targetChatId) {
    const notifText = isRegister
      ? `⚠️ <b>User Registered</b>\n\nAdmin telah memberikan role <b>${selectedRoles.join(", ")}</b> untuk Anda. Ketik /start lalu tap "Who Am I" untuk cek role Anda.`
      : `ℹ️ <b>Role Diperbarui</b>\n\nRole Anda sekarang: <b>${selectedRoles.join(", ")}</b>.`;
    await ctx.api
      .sendMessage(targetChatId, notifText, {parse_mode: "HTML"})
      .catch(() => {});
  }
}

async function handleRoleCancel(ctx: Context, info: ParsedInfo) {
  await clearBotSession(info.chatId!);
  await ctx.answerCallbackQuery({text: "Dibatalkan."});
  const user = await validateUser(ctx, info);
  await safeEditMessageText(
    ctx,
    `Halo <b>${user.NAME || "Pengguna"}</b>! Silakan pilih menu di bawah ini:`,
    {parse_mode: "HTML", reply_markup: buildMainMenuKeyboard(user.ROLES)},
  );
}

async function handleCheckedEdit(ctx: Context, info: ParsedInfo) {
  const chatId = info.chatId!;
  const session = await getBotSession(chatId);
  if (!session || session.state !== "CHECKED_USER" || !session.data.username) {
    await ctx.answerCallbackQuery({text: "Sesi sudah kedaluwarsa. Ketik /start untuk mulai lagi.", show_alert: true});
    return;
  }

  const adminUser = await validateUser(ctx, info);
  if (!isAdmin(adminUser.ROLES)) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak memiliki akses.", show_alert: true});
    return;
  }

  const targetUser = await findUserByUsername(session.data.username);
  if (!targetUser) {
    await clearBotSession(chatId);
    await ctx.answerCallbackQuery({text: "User tidak ditemukan.", show_alert: true});
    return;
  }

  await setBotSession(chatId, "SELECT_EDIT_ROLES", {username: targetUser.USERNAME, roles: [...targetUser.ROLES]});
  await ctx.answerCallbackQuery();
  const {ROLES: allRoles} = await getMasterData();
  await safeEditMessageText(
    ctx,
    `✏️ <b>Edit Role User</b>\n\nUsername: <b>@${targetUser.USERNAME}</b>\nUbah role lalu tap "Simpan":`,
    {parse_mode: "HTML", reply_markup: buildRoleSelectKeyboard(allRoles, targetUser.ROLES)},
  );
}

async function handleCheckedDelete(ctx: Context, info: ParsedInfo) {
  const chatId = info.chatId!;
  const session = await getBotSession(chatId);
  if (!session || session.state !== "CHECKED_USER" || !session.data.username) {
    await ctx.answerCallbackQuery({text: "Sesi sudah kedaluwarsa. Ketik /start untuk mulai lagi.", show_alert: true});
    return;
  }
  const targetUsername = session.data.username;

  const adminUser = await validateUser(ctx, info);
  if (!isAdmin(adminUser.ROLES)) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak memiliki akses.", show_alert: true});
    return;
  }

  if (targetUsername.toLowerCase() === adminUser.USERNAME.toLowerCase()) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak bisa menghapus akun Anda sendiri.", show_alert: true});
    return;
  }

  await setBotSession(chatId, "CONFIRM_DELETE", {username: targetUsername});
  await ctx.answerCallbackQuery();
  await safeEditMessageText(
    ctx,
    `⚠️ <b>Konfirmasi Hapus User</b>\n\nYakin ingin menghapus user <b>@${targetUsername}</b>? Tindakan ini tidak bisa dibatalkan.`,
    {parse_mode: "HTML", reply_markup: buildConfirmDeleteKeyboard()},
  );
}

async function handleDeleteYes(ctx: Context, info: ParsedInfo) {
  const chatId = info.chatId!;
  const session = await getBotSession(chatId);
  if (!session || session.state !== "CONFIRM_DELETE" || !session.data.username) {
    await ctx.answerCallbackQuery({text: "Sesi sudah kedaluwarsa. Ketik /start untuk mulai lagi.", show_alert: true});
    return;
  }

  const adminUser = await validateUser(ctx, info);
  if (!isAdmin(adminUser.ROLES)) {
    await ctx.answerCallbackQuery({text: "⛔ Anda tidak memiliki akses.", show_alert: true});
    return;
  }

  const targetUsername = session.data.username;
  await deleteUserByUsername(targetUsername);
  await clearBotSession(chatId);
  await ctx.answerCallbackQuery({text: "✅ User berhasil dihapus."});
  await safeEditMessageText(
    ctx,
    `✅ User <b>@${targetUsername}</b> berhasil dihapus dari sistem.`,
    {parse_mode: "HTML", reply_markup: buildBackToMenuKeyboard()},
  );
}

async function handleDeleteNo(ctx: Context, chatId: string) {
  const session = await getBotSession(chatId);
  if (!session || session.state !== "CONFIRM_DELETE" || !session.data.username) {
    await ctx.answerCallbackQuery();
    return;
  }

  const targetUser = await findUserByUsername(session.data.username);
  if (!targetUser) {
    await clearBotSession(chatId);
    await ctx.answerCallbackQuery({text: "User tidak ditemukan.", show_alert: true});
    return;
  }

  await setBotSession(chatId, "CHECKED_USER", {username: targetUser.USERNAME});
  await ctx.answerCallbackQuery();
  await safeEditMessageText(ctx, formatUserCard(targetUser), {
    parse_mode: "HTML",
    reply_markup: buildCheckedUserKeyboard(),
  });
}
