import 'server-only';
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

type FnDateJs =
  | (() => dayjs.Dayjs)
  | ((date?: dayjs.ConfigType) => dayjs.Dayjs)
  | ((date?: dayjs.ConfigType, format?: dayjs.OptionType, strict?: boolean) => dayjs.Dayjs)
  | ((date?: dayjs.ConfigType, format?: dayjs.OptionType, locale?: string, strict?: boolean) => dayjs.Dayjs);
type ParamDateJs =
  | []
  | [date: dayjs.ConfigType]
  | [date: dayjs.ConfigType, format: dayjs.OptionType, strict?: boolean]
  | [date: dayjs.ConfigType, format: dayjs.OptionType, locale?: string, strict?: boolean];


const serverDayJs: FnDateJs = (...args: ParamDateJs): dayjs.Dayjs => {
  if (args.length == 1) {
    const [date] = args;
    return dayjs(date).tz("Asia/Jakarta");
  } else if (args.length == 2) {
    const [date, format] = args;
    return dayjs(date, format).tz("Asia/Jakarta");
  } else if (args.length == 3) {
    const [date, format, localeOrStrict] = args;
    if (localeOrStrict !== undefined) {
      if (typeof localeOrStrict === 'string') {
        return dayjs(date, format, localeOrStrict).tz("Asia/Jakarta");
      } else {
        return dayjs(date, format, localeOrStrict).tz("Asia/Jakarta");
      }
    } else {
      return dayjs(date, format).tz("Asia/Jakarta");
    }
  } else if (args.length == 4) {
    const [date, format, locale, strict] = args;
    return dayjs(date, format, locale, strict).tz("Asia/Jakarta");
  } else {
    return dayjs().tz("Asia/Jakarta");
  }
}

export default serverDayJs;