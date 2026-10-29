/**
 * Participants of the CBRT (TCMB) payment systems, by their four-digit code.
 * A Turkish IBAN's five-digit bank code is a zero plus this code:
 * TR33 0006 2… → 00062 → 0062, Garanti.
 *
 * Source: TCMB Ödeme Sistemleri Katılımcıları, https://www.tcmb.gov.tr/
 * (70 participants, last change 18.09.2026). Names are TCMB's, as published.
 */
export interface TurkishBank {
  /** Four-digit TCMB code, as in the IBAN: `"0062"`. */
  readonly code: string;
  /** Name as TCMB publishes it: `"T. GARANTİ BANKASI A.Ş."`. */
  readonly name: string;
}

/** Every participant, sorted by code. A plain literal, so it drops out of bundles that never use it. */
export const turkishBanks: readonly TurkishBank[] = [
  { code: "0001", name: "T.C. MERKEZ BANKASI" },
  { code: "0004", name: "İLLER BANKASI A.Ş." },
  { code: "0010", name: "T.C. ZİRAAT BANKASI A.Ş." },
  { code: "0012", name: "T. HALK BANKASI A.Ş." },
  { code: "0014", name: "T. SINAİ KALKINMA BANKASI A.Ş." },
  { code: "0015", name: "T. VAKIFLAR BANKASI T.A.O." },
  { code: "0016", name: "T. EXİMBANK" },
  { code: "0017", name: "T. KALKINMA BANKASI A.Ş." },
  { code: "0029", name: "BİRLEŞİK FON BANKASI A.Ş." },
  { code: "0032", name: "T. EKONOMİ BANKASI A.Ş." },
  { code: "0046", name: "AKBANK T.A.Ş." },
  { code: "0059", name: "ŞEKERBANK T.A.Ş." },
  { code: "0060", name: "TÜRK TİCARET BANKASI A.Ş." },
  { code: "0062", name: "T. GARANTİ BANKASI A.Ş." },
  { code: "0064", name: "T. İŞ BANKASI A.Ş." },
  { code: "0067", name: "YAPI VE KREDİ BANKASI A.Ş." },
  { code: "0091", name: "ARAP TÜRK BANKASI" },
  { code: "0092", name: "CITIBANK A.Ş." },
  { code: "0096", name: "FREEDOM BANK A.Ş." },
  { code: "0098", name: "JPMORGAN CHASE BANK N.A." },
  { code: "0099", name: "ING BANK A.Ş." },
  { code: "0103", name: "FİBABANKA A.Ş." },
  { code: "0108", name: "TURKLAND BANK A.S." },
  { code: "0109", name: "ICBC TURKEY BANK A.Ş." },
  { code: "0111", name: "QNB FİNANSBANK A.Ş." },
  { code: "0115", name: "DEUTSCHE BANK A.Ş." },
  { code: "0116", name: "PASHA YATIRIM BANK A.Ş." },
  { code: "0121", name: "STANDARD CHARTERED YATIRIM BANKASI TÜRK A.Ş." },
  { code: "0122", name: "SOCIETE GENERALE (SA)" },
  { code: "0123", name: "HSBC BANK A.Ş." },
  { code: "0124", name: "ALTERNATİFBANK A.Ş." },
  { code: "0125", name: "BURGAN BANK A.Ş." },
  { code: "0129", name: "BANK OF AMERICA YATIRIM BANK A.Ş." },
  { code: "0132", name: "İSTANBUL TAKAS VE SAKLAMA BANK. A.Ş." },
  { code: "0134", name: "DENİZBANK A.Ş." },
  { code: "0135", name: "ANADOLUBANK A.Ş." },
  { code: "0137", name: "HEPSİ BANK A.Ş." },
  { code: "0138", name: "DİLER YATIRIM BANKASI A.Ş." },
  { code: "0139", name: "GSD YATIRIM BANKASI A.Ş." },
  { code: "0141", name: "NUROL YATIRIM BANKASI A.Ş." },
  { code: "0142", name: "BANKPOZİTİF KREDİ VE KALK.BANK.A.Ş." },
  { code: "0143", name: "AKTİF YATIRIM BANKASI A.Ş." },
  { code: "0146", name: "ODEA BANK A.Ş." },
  { code: "0147", name: "MUFG BANK TURKEY A.Ş." },
  { code: "0148", name: "INTESA SANPAOLO S.P.A." },
  { code: "0149", name: "BANK OF CHINA TURKEY A.Ş." },
  { code: "0151", name: "D YATIRIM BANKASI A.Ş." },
  { code: "0152", name: "DESTEK YATIRIM BANKASI A.Ş." },
  { code: "0153", name: "MİSYON YATIRIM BANKASI A.Ş." },
  { code: "0154", name: "TERA YATIRIM BANKASI A.Ş." },
  { code: "0155", name: "Q YATIRIM BANKASI A.Ş." },
  { code: "0156", name: "HEDEF YATIRIM BANKASI A.Ş." },
  { code: "0157", name: "ENPARA BANK A.Ş." },
  { code: "0158", name: "COLENDİ BANK A.Ş." },
  { code: "0159", name: "FUPS BANK A.Ş." },
  { code: "0160", name: "ZİRAAT DİNAMİK BANKA A.Ş." },
  { code: "0161", name: "AYTEMİZ YATIRIM BANKASI A.Ş." },
  { code: "0203", name: "ALBARAKA TÜRK KATILIM BANKASI A.Ş." },
  { code: "0205", name: "KUVEYT TÜRK KATILIM BANKASI A.Ş." },
  { code: "0206", name: "TÜRKİYE FİNANS KATILIM BANKASI A.Ş." },
  { code: "0209", name: "ZİRAAT KATILIM BANKASI A.Ş." },
  { code: "0210", name: "VAKIF KATILIM BANKASI A.Ş." },
  { code: "0211", name: "TÜRKİYE EMLAK KATILIM BANKASI A.Ş." },
  { code: "0212", name: "HAYAT FİNANS KATILIM BANKASI" },
  { code: "0213", name: "T.O.M. KATILIM BANKASI A.Ş." },
  { code: "0214", name: "DÜNYA KATILIM BANKASI A.Ş." },
  { code: "0215", name: "ADİL KATILIM BANKASI A.Ş." },
  { code: "0216", name: "İKTİSAT KATILIM BANKASI A.Ş." },
  { code: "0806", name: "MERKEZİ KAYIT KURULUŞU A.Ş." },
  { code: "0807", name: "POSTA VE TELGRAF TEŞKİLATI A.Ş." },
];

let byCode: Map<string, TurkishBank> | undefined;

/**
 * The bank a Turkish IBAN belongs to, read from its bank code. Works on a
 * partial IBAN as soon as the bank digits are typed (`"TR33 0006 2"`), with or
 * without spaces. Returns `null` for other countries and unknown codes. It does
 * not check the IBAN itself; use `isValidIBAN` for that.
 */
export function getTurkishBank(iban: string): TurkishBank | null {
  const value = iban.replace(/\s/g, "").toUpperCase();
  if (!/^TR\d{7}/.test(value) || value[4] !== "0") return null;
  byCode ??= new Map(turkishBanks.map((bank) => [bank.code, bank]));
  return byCode.get(value.slice(5, 9)) ?? null;
}
