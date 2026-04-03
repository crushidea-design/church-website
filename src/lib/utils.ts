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

export const YOUTUBE_REGEX = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[^\s]*)?)/g;

export const getYouTubeId = (content: string) => {
  if (!content) return null;
  const regex = /(?:https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11}))/;
  const match = content.match(regex);
  return match ? match[1] : null;
};
