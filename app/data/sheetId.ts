export type SheetOption = {
  /** Human friendly label shown in dropdown */
  label: string;
  /** Google Spreadsheet ID (value actually used by API) */
  value: string;
  /** Optional short description for tooling / accessibility */
  description?: string;
  latitude?: number;
  longitude?: number;
};

export const SHEET_OPTIONS: SheetOption[] = [
  {
    label: "Select a spreadsheet...",
    value: "",
    description: "Select a spreadsheet…",
  },
  {
    label: "Aalo",
    value: "17S0IpeyXptm5O9viB3atTJd7p05KxPwacGWe1sHqMeo",
    description: "Aalo Weather station spreadsheet",
    latitude: 28.1695,
    longitude: 94.8006,
  },
  {
    label: "Anini",
    value: "1QnIXcyHo9YHqL_bt3q-QkzXsUJDWAx52DBZl2lRrUNk",
    description: "Anini Weather station spreadsheet",
    latitude: 28.7972,
    longitude: 95.9048,
  },
  {
    label: "Basar",
    value: "1JDiURUtrHKhkjQMgVssByFjtFve22MX7le67KlhIFzc",
    description: "Basar Weather station spreadsheet",
    latitude: 27.9826,
    longitude: 94.6898,
  },
  {
    label: "Boleng",
    value: "1K6A42f3ZmCzhVN69ZPCKoCQc_O5hNBtDEGWznFFyIzY",
    description: "Boleng Weather station spreadsheet",
    latitude: 28.335,
    longitude: 94.961,
  },
  {
    label: "Bomdila",
    value: "1aumUMq-H-vA-HshjomUEprpDUcuJkn8SO5nqvsSsxaY",
    description: "Bomdila Weather station spreadsheet",
    latitude: 27.2645,
    longitude: 92.4159,
  },
  {
    label: "Changlang",
    value: "1e4DFLemRe5JX29RfBZ4bqdmirFxBvhO6KgIPzlxv6rY",
    description: "Changlang Weather station spreadsheet",
    latitude: 27.1355,
    longitude: 95.7364,
  },
  {
    label: "Daporijo",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM",
    description: "Daporijo Weather station spreadsheet",
    latitude: 27.986,
    longitude: 94.216,
  },
  {
    label: "Hawai",
    value: "115_s9up5F7ppqzFD0cYnrYZSzbrtfjuEBpqMQdKP0vA",
    description: "Hawai Weather station spreadsheet",
    latitude: 27.8843,
    longitude: 96.8169,
  },
  {
    label: "Jamin",
    value: "1dk8c2miq5JjO1u_l0MOk4tRW9qGqnMiD3JFDrp_jL",
    description: "Jamin Weather station spreadsheet",
    latitude: 27.753,
    longitude: 93.617,
  },
  {
    label: "Khonsa",
    value: "1nZWwQKkjlQzdt0ZMxqjpo61qOv-8qDJtTgaevKPkSMA",
    description: "Khonsa Weather station spreadsheet",
    latitude: 26.9926,
    longitude: 95.5014,
  },
  {
    label: "Koloriang",
    value: "1NIpubb8iUGJte2VbYFCeuRyB59JxqBQ46VebOpWFbwg",
    description: "Koloriang Weather station spreadsheet",
    latitude: 27.9038,
    longitude: 93.3534,
  },
  {
    label: "Lemmi",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Lemmi Weather station spreadsheet",
    latitude: 27.1916,
    longitude: 93.2629,
  },
  {
    label: "Likabali",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Likabali Weather station spreadsheet",
    latitude: 27.6605,
    longitude: 94.7012,
  },
  {
    label: "Longding",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Longding Weather station spreadsheet",
    latitude: 26.8372,
    longitude: 95.3521,
  },
  {
    label: "Namsai",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Namsai Weather station spreadsheet",
    latitude: 27.6666,
    longitude: 95.8626,
  },
  {
    label: "Napangphung",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Napangphung Weather station spreadsheet",
    latitude: 27.2015,
    longitude: 92.533,
  },
  {
    label: "Pasighat",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Pasighat Weather station spreadsheet",
    latitude: 28.0632,
    longitude: 95.3239,
  },
  {
    label: "Raga",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Raga Weather station spreadsheet",
    latitude: 28.0632,
    longitude: 95.3239,
  },
  {
    label: "Roing",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Roing Weather station spreadsheet",
    latitude: 28.14318,
    longitude: 95.84468,
  },
  {
    label: "Seppa",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Seppa Weather station spreadsheet",
    latitude: 27.361,
    longitude: 93.0393,
  },
  {
    label: "Tato",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Tato Weather station spreadsheet",
    latitude: 28.529,
    longitude: 94.373,
  },
  {
    label: "Tawang Town",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Tawang Town Weather station spreadsheet",
    latitude: 27.5861,
    longitude: 91.8594,
  },
  {
    label: "Tezu",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Tezu Weather station spreadsheet",
    latitude: 27.9277,
    longitude: 96.1533,
  },
  {
    label: "Yachuli",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Yachuli Weather station spreadsheet",
    latitude: 27.509,
    longitude: 93.7862,
  },
  {
    label: "Yingkiong",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Yingkiong Weather station spreadsheet",
    latitude: 28.6236,
    longitude: 95.0365,
  },
  {
    label: "Yupia",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Yupia Weather station spreadsheet",
    latitude: 27.1465,
    longitude: 93.7194,
  },
  {
    label: "Ziro",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Ziro Weather station spreadsheet",
    latitude: 27.5449,
    longitude: 93.8197,
  },
  {
    label: "Bhalukpong",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Bhalukpong Weather station spreadsheet",
    latitude: 27.0137,
    longitude: 92.6345,
  },
  {
    label: "Saijosa (Pakhui)",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Saijosa (Pakhui) Weather station spreadsheet",
    latitude: 26.9585,
    longitude: 93.011,
  },
  {
    label: "Mayudia",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Mayudia Weather station spreadsheet",
    latitude: 28.242,
    longitude: 95.9253,
  },
  {
    label: "Hayuliang",
    value: "1YaVltgsC2_RdOP1I6c7IryV4rw_LXpgNCu0ciip5GqM", //TBD
    description: "Hayuliang Weather station spreadsheet",
    latitude: 28.0785,
    longitude: 96.543,
  },
];

export const DEFAULT_SHEET_ID: string | null =
  SHEET_OPTIONS.length > 0 ? SHEET_OPTIONS[0].value : null;

export function getSheetOptions(): SheetOption[] {
  return SHEET_OPTIONS;
}

export default SHEET_OPTIONS;
