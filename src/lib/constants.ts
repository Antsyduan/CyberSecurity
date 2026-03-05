// PII 個資等級定義
export const PII_LEVELS = [
  { value: "L1", label: "L1 - 直接識別", description: "可直接識別個人" },
  { value: "L2", label: "L2 - 間接識別", description: "可間接識別個人" },
  { value: "L3", label: "L3 - 準識別", description: "需與其他資料結合才能識別" },
  { value: "L4", label: "L4 - 敏感", description: "敏感但非直接識別" },
] as const;

export type PiiLevel = (typeof PII_LEVELS)[number]["value"];

// 環境區域
export const ZONE_TYPES = {
  production: "正式機",
  backup: "備援機",
  deidentified: "內部去個資機",
} as const;
