import {botCmdStartDesc} from "@/lib/telegramBot/command/bot-cmd-start";
import {botCmdHelpDesc} from "@/lib/telegramBot/command/bot-cmd-help";
import {botCmdWhoAmIDesc} from "@/lib/telegramBot/command/bot-cmd-whoami";
import {botCmdRegisterUserDesc} from "@/lib/telegramBot/command/bot-cmd-registeruser";
import {botCmdCheckUserDesc} from "@/lib/telegramBot/command/bot-cmd-checkuser";

type COMMAND_TYPE =
  "start" |
  "help" |
  "whoami" |
  "registeruser" |
  "checkuser"

const COMMAND_LIST: Record<COMMAND_TYPE, COMMAND_TYPE> = {
  start: "start",
  help: "help",
  whoami: "whoami",
  registeruser: "registeruser",
  checkuser: "checkuser",
} as const;

const COMMAND_DESC_LIST: Record<COMMAND_TYPE, string> = {
  start: botCmdStartDesc,
  help: botCmdHelpDesc,
  whoami: botCmdWhoAmIDesc,
  registeruser: botCmdRegisterUserDesc,
  checkuser: botCmdCheckUserDesc,
} as const;

const ALLOWED_COMMAND_ALL_ROLE = [
  "start",
  "help",
  "whoami",
] as const;

const ALLOWED_COMMAND_BY_ROLE = {
  ADMIN: ['registeruser', 'checkuser'],
  FLORIST: [],
  KURIR: [],
} as const;

export {
  COMMAND_LIST,
  ALLOWED_COMMAND_ALL_ROLE,
  ALLOWED_COMMAND_BY_ROLE,
  COMMAND_DESC_LIST
}