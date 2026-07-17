export type ImportFieldKey =
  | "date"
  | "amount"
  | "firstName"
  | "lastName"
  | "email"
  | "fund"
  | "paymentMethod"
  | "fee"
  | "note";

export type ImportField = {
  key: ImportFieldKey;
  label: string;
  required: boolean;
  help?: string;
  /** Normalized header candidates used to auto-detect the source column. */
  aliases: Array<string>;
};

/**
 * The Causeway fields a Tithe.ly giving export can be mapped onto. Only `date`
 * and `amount` are required to create a transaction; the rest enrich the donor
 * contact and the transaction record.
 */
export const importFields: Array<ImportField> = [
  {
    key: "date",
    label: "Gift date",
    required: true,
    aliases: ["date", "giftdate", "transactiondate", "createddate", "createdat"],
  },
  {
    key: "amount",
    label: "Amount",
    required: true,
    help: "Gross gift amount",
    aliases: ["amount", "grossamount", "giftamount", "totalamount", "total"],
  },
  { key: "firstName", label: "Donor first name", required: false, aliases: ["firstname", "first"] },
  { key: "lastName", label: "Donor last name", required: false, aliases: ["lastname", "last"] },
  { key: "email", label: "Donor email", required: false, aliases: ["email", "emailaddress", "giveremail"] },
  {
    key: "fund",
    label: "Fund",
    required: false,
    help: "You'll match this to an account in the next step",
    aliases: ["fund", "fundname", "designation", "category"],
  },
  {
    key: "paymentMethod",
    label: "Payment method",
    required: false,
    aliases: ["paymentmethod", "method", "paymenttype"],
  },
  { key: "fee", label: "Processing fee", required: false, aliases: ["fee", "fees", "processingfee"] },
  { key: "note", label: "Note / memo", required: false, aliases: ["note", "notes", "memo", "comment", "comments"] },
];

/** Sentinel used by the mapper UI to represent "not mapped to any column". */
export const UNMAPPED = -1;

export type ColumnMapping = Record<ImportFieldKey, number>;

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Guess a source column index for each import field by matching normalized CSV
 * headers against each field's aliases. Unmatched fields map to UNMAPPED.
 */
export function autoDetectMapping(headers: Array<string>): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as ColumnMapping;
  for (const field of importFields) {
    mapping[field.key] = normalized.findIndex((h) => field.aliases.includes(h));
  }
  return mapping;
}

/** Import fields whose required source column has not yet been mapped. */
export function missingRequiredFields(mapping: ColumnMapping): Array<ImportField> {
  return importFields.filter((f) => f.required && (mapping[f.key] ?? UNMAPPED) === UNMAPPED);
}
