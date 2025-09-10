import { Prisma, TransactionItemTypeDirection } from "@prisma/client";
import {
  IconAffiliate,
  IconBuildingBank,
  IconCoin,
  IconCreditCard,
  IconCreditCardPay,
  IconCreditCardRefund,
  IconFileSpreadsheet,
  IconPaperclip,
  IconTransfer,
  IconUserHeart,
  IconUsers,
  IconUsersGroup,
} from "@tabler/icons-react";

export enum AccountType {
  Operating = 1,
  Benevolence = 2,
  Ministry = 3,
}

export enum ContactType {
  Donor = 1,
  External = 2,
  Missionary = 3,
  Staff = 4,
  Outreach = 5,
  Organization = 6,
  Donor_and_Missionary = 7,
}

export enum EngagementType {
  In_Person = 1,
  Phone = 2,
  Text = 3,
  Email = 4,
  Mail = 5,
}

export enum TransactionItemType {
  Donation = 1,
  Income = 2,
  Expense = 3,
  Compensation = 4,
  Grant = 5,
  Tax = 6,
  Transfer_In = 7,
  Transfer_Out = 8,
  Other_Incoming = 9,
  Other_Outgoing = 10,
  Fee = 11,
}

export enum TransactionItemMethod {
  PayPal = 1,
  Check = 2,
  ACH = 3,
  Credit_Card = 4,
  Debit_Card = 5,
  Tithely = 6,
  Other = 7,
}

export enum TransactionCategory {
  Donation_Standard = 1,
  Donation_In_Kind = 2,
  Donation_Grant_Incoming = 3,
  Donation_Soft_Credit = 4,
  Donation_Fundraiser = 5,
  Income_Other = 6,
  Income_Interest_Earned = 7,
  Income_Cashback = 8,
  Income_Fundraiser = 9,
  Income_Bank_Verification = 10,
  Expense_Other = 11,
  Expense_Bank_Verification = 12,
  Expense_Benevolence = 13,
  Expense_Fundraising_Expenses = 14,
  Expense_Operational_Supplies = 15,
  Expense_Office_Supplies = 16,
  Expense_Printing_Promotional_Marketing = 17,
  Expense_Postage = 18,
  Expense_Shipping_Fundraiser_Only = 19,
  Expense_Technology = 20,
  Expense_Compensation_Mission_Partner = 21,
  Expense_Compensation_Admin_Tasks = 22,
  Expense_Grant_Outgoing = 23,
  Expense_Travel_Local = 24,
  Expense_Accounting_Compliance = 25,
  Expense_Travel_Domestic_and_International = 26,
  Internal_Transfer_Gain = 27,
  Internal_Transfer_Loss = 28,
}

export const transactionCategories: Array<{ id: TransactionCategory; name: string }> = [
  { id: 1, name: "Donation: Standard" },
  { id: 2, name: "Donation: In-Kind" },
  { id: 3, name: "Donation: Grant (incoming)" },
  { id: 4, name: "Donation: Soft Credit" },
  { id: 5, name: "Donation: Fundraiser" },
  { id: 6, name: "Income: Other" },
  { id: 7, name: "Income: Interest (earned)" },
  { id: 8, name: "Income: Cashback" },
  { id: 9, name: "Income: Fundraiser" },
  { id: 10, name: "Income: Bank Verification" },
  { id: 11, name: "Expense: Other" },
  { id: 12, name: "Expense: Bank Verification" },
  { id: 13, name: "Expense: Benevolence" },
  { id: 14, name: "Expense: Fundraising Expenses" },
  { id: 15, name: "Expense: Operational Supplies" },
  { id: 16, name: "Expense: Office Supplies" },
  { id: 17, name: "Expense: Printing/Promotional/Marketing" },
  { id: 18, name: "Expense: Postage" },
  { id: 19, name: "Expense: Shipping (Fundraiser Only)" },
  { id: 20, name: "Expense: Technology" },
  { id: 21, name: "Expense: Compensation (Mission Partner)" },
  { id: 22, name: "Expense: Compensation (Admin Tasks)" },
  { id: 23, name: "Expense: Grant (outgoing)" },
  { id: 24, name: "Expense: Travel (Local)" },
  { id: 25, name: "Expense: Accounting/Compliance" },
  { id: 26, name: "Expense: Travel (Domestic and International)" },
  { id: 27, name: "Internal: Transfer Gain" },
  { id: 28, name: "Internal: Transfer Loss " },
] as const;

export const transactionItemMethods: Array<{ id: TransactionItemMethod; name: string }> = [
  { id: 1, name: "PayPal" },
  { id: 2, name: "Check" },
  { id: 3, name: "ACH" },
  { id: 4, name: "Credit Card" },
  { id: 5, name: "Debit Card" },
  { id: 6, name: "Tithe.ly" },
  { id: 7, name: "Other" },
];

export const transactionItemTypes: Array<{
  id: TransactionItemType;
  name: string;
  direction: TransactionItemTypeDirection;
}> = [
  { id: 1, name: "Donation", direction: TransactionItemTypeDirection.IN },
  { id: 2, name: "Income", direction: TransactionItemTypeDirection.IN },
  { id: 3, name: "Expense", direction: TransactionItemTypeDirection.OUT },
  { id: 4, name: "Compensation", direction: TransactionItemTypeDirection.OUT },
  { id: 5, name: "Grant", direction: TransactionItemTypeDirection.OUT },
  { id: 6, name: "Tax", direction: TransactionItemTypeDirection.OUT },
  { id: 7, name: "Transfer In", direction: TransactionItemTypeDirection.IN },
  { id: 8, name: "Transfer Out", direction: TransactionItemTypeDirection.OUT },
  { id: 9, name: "Other (Incoming)", direction: TransactionItemTypeDirection.IN },
  { id: 10, name: "Other (Outgoing)", direction: TransactionItemTypeDirection.OUT },
  { id: 11, name: "Fee", direction: TransactionItemTypeDirection.OUT },
];

export const contactTypes: Array<{ id: ContactType; name: string }> = [
  { id: 1, name: "Donor" },
  { id: 2, name: "External" },
  { id: 3, name: "Missionary" },
  { id: 4, name: "Staff" },
  { id: 5, name: "Outreach" },
  { id: 6, name: "Organization" },
  { id: 7, name: "Donor and Missionary" },
];

export const accountTypes: Array<{ id: AccountType; name: string }> = [
  { id: 1, name: "Operating" },
  { id: 2, name: "Benevolence" },
  { id: 3, name: "Ministry" },
];

export const engagementTypes: Array<{ id: EngagementType; name: string }> = [
  { id: 1, name: "In Person" },
  { id: 2, name: "Phone" },
  { id: 3, name: "Text" },
  { id: 4, name: "Email" },
  { id: 5, name: "Mail" },
];

export const defaultAccounts: Array<Omit<Prisma.AccountUncheckedCreateInput, "orgId">> = [
  { code: "1001", description: "General Fund", typeId: AccountType.Operating },
  { code: "1002", description: "Local", typeId: AccountType.Operating },
  { code: "1003", description: "International", typeId: AccountType.Operating },
];

export interface AppNavLink {
  name: string;
  to: string;
  end: boolean;
  icon: typeof IconCreditCard;
  prefetch?: boolean;
}

export const globalNavLinks: ReadonlyArray<AppNavLink> = [
  { name: "Transactions", to: "/transactions", end: false, prefetch: false, icon: IconCreditCard },
  { name: "Contacts", to: "/contacts", end: false, prefetch: false, icon: IconUsers },
  { name: "Engagements", to: "/engagements", end: true, prefetch: false, icon: IconUserHeart },
  { name: "Reimbursement", to: "/reimbursements/new", end: false, prefetch: true, icon: IconCoin },
] as const;

export const userNavLinks: ReadonlyArray<AppNavLink> = [] as const;

export const adminNavLinks: ReadonlyArray<AppNavLink> = [
  { name: "Income", to: "/income/new", end: false, prefetch: true, icon: IconCreditCardRefund },
  { name: "Expense", to: "/expense/new", end: false, prefetch: true, icon: IconCreditCardPay },
  { name: "Transfer", to: "/transfer/new", end: false, prefetch: true, icon: IconTransfer },
  { name: "Accounts", to: "/accounts", end: false, prefetch: false, icon: IconBuildingBank },
  { name: "Users", to: "/users", end: false, prefetch: false, icon: IconUsersGroup },
  { name: "Reimbursements", to: "/reimbursements", end: true, prefetch: false, icon: IconCoin },
  // { name: "Receipts", to: "/receipts", end: true, prefetch: false, icon: IconReceipt },
  { name: "Organization", to: "/organization", end: false, prefetch: true, icon: IconAffiliate },
  { name: "Reports", to: "/reports", end: true, prefetch: true, icon: IconFileSpreadsheet },
  { name: "Attachments", to: "/attachments", end: true, prefetch: false, icon: IconPaperclip },
] as const;

export const superAdminNavLinks: ReadonlyArray<AppNavLink> = [] as const;
