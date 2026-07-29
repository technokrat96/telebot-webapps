import {parseDataTelegram, validateUser} from "@/lib/telegramBot/telegramBotUtil";
import {
  ALLOWED_COMMAND_ALL_ROLE,
  ALLOWED_COMMAND_BY_ROLE,
  COMMAND_DESC_LIST,
  COMMAND_LIST
} from "@/lib/telegramBot/telegramBotConst";
import {CommandContext, Context} from "grammy";

const botCmdStartDesc = "Memulai dan cek status aktif bot";
const botCmdStart = async (ctx: CommandContext<Context>) => {
  try {
    const {
      chatId,
      userId,
      username,
      name,
    } = await parseDataTelegram(ctx);

    const user = await validateUser(ctx, {username, name, chatId, userId});

    const allowedKeys = new Set<keyof typeof COMMAND_LIST>([...ALLOWED_COMMAND_ALL_ROLE]);

    if (user.ROLES && Array.isArray(user.ROLES)) {
      user.ROLES.forEach((roleName) => {
        const roleCmds = ALLOWED_COMMAND_BY_ROLE[roleName];
        if (roleCmds) {
          roleCmds.forEach((cmdKey) => allowedKeys.add(cmdKey));
        }
      });
    }

    const commandList = Object.entries(COMMAND_LIST)
      .filter(([key]) => allowedKeys.has(key as keyof typeof COMMAND_LIST))
      .map(
        ([key, cmd]) =>
          `/${cmd} - ${COMMAND_DESC_LIST[key as keyof typeof COMMAND_LIST] ?? "Tanpa deskripsi"}`,
      )
      .join("\n");

    let messageReply = `Halo <b>${user.NAME || "Pengguna"}</b>! Status bot dalam keadaan aktif.`;

    // Memanggil fungsi help secara internal untuk menampilkan menu sesuai role USER
    const daftarMenu = `🤖 <b>Daftar Perintah Bot yang Tersedia untuk Anda</b>:\n\n${commandList}`;
    messageReply += `\n\n${daftarMenu}`;

    await ctx.reply(messageReply, {
      parse_mode: "HTML"
    });
  } catch (e) {
    if (e instanceof Error) {
      await ctx.reply(`Error ${e.message}`, {
        parse_mode: "HTML",
      },);
    } else if (typeof e == "string") {
      await ctx.reply(e, {
        parse_mode: "HTML",
      },);
    }
  }
}

export {
  botCmdStartDesc,
  botCmdStart
};