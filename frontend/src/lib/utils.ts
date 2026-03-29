import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return '$' + (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return '$' + (value / 1_000).toFixed(0) + 'K';
  }
  return '$' + value.toLocaleString('en-US');
}

export function formatCurrencyFull(value: number): string {
  return '$' + Math.round(value).toLocaleString('en-US');
}

export function formatPercent(value: number, decimals = 1): string {
  return value.toFixed(decimals) + '%';
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return formatDateShort(dateStr);
}

export function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export function calcDSCR(normalizedSDE: number, annualDebtService: number): number {
  if (annualDebtService <= 0) return 0;
  return normalizedSDE / annualDebtService;
}

export function calcNormalizedSDE(
  revenue: number,
  cogs: number,
  opex: number,
  ownerSalary: number,
  oneTime: number,
  personalAddbacks: number
): number {
  const netIncome = revenue - cogs - opex;
  return netIncome + ownerSalary + personalAddbacks + oneTime;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '…';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function statusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const STAGE_ORDER = [
  'identified',
  'contacted',
  'discovery',
  'financial_review',
  'loi_discussion',
  'loi_signed',
  'due_diligence',
  'financing',
  'closing',
  'closed',
  'lost',
] as const;

export const STAGE_LABELS: Record<string, string> = {
  identified: 'Identified',
  contacted: 'Contacted',
  discovery: 'Discovery',
  financial_review: 'Financial Review',
  loi_discussion: 'LOI Discussion',
  loi_signed: 'LOI Signed',
  due_diligence: 'Due Diligence',
  financing: 'Financing',
  closing: 'Closing',
  closed: 'Closed Won',
  lost: 'Lost',
};
