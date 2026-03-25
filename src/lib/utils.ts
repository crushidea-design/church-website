import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: any, formatStr: string = 'yyyy.MM.dd') {
  if (!date) return '';
  try {
    const d = date?.toDate ? date.toDate() : new Date(date);
    return format(d, formatStr);
  } catch (e) {
    return '';
  }
}
