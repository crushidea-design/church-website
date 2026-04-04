import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'regular' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  fcmToken?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  category: 'sermon' | 'research' | 'community' | 'journal' | 'today_word';
  subCategory?: string;
  sermonCategoryId?: string;
  researchCategoryId?: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  viewCount: number;
  commentCount: number;
  videoUrl?: string;
  pdfUrl?: string;
  thumbnailUrl?: string;
  sortOrder?: string;
  isPrivate?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface SermonCategory {
  id: string;
  name: string;
  order: number;
  createdAt: Timestamp | Date;
}

export interface ResearchCategory {
  id: string;
  name: string;
  order: number;
  createdAt: Timestamp | Date;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  createdAt: Timestamp | Date;
  isRead: boolean;
}
