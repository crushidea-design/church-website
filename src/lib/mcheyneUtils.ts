// @ts-ignore
import ReadingPlan from 'bible-in-one-year';
import { getDayOfYear } from 'date-fns';

export const bookNameMap: Record<string, string> = {
  'Genesis': '창세기', 'Exodus': '출애굽기', 'Leviticus': '레위기', 'Numbers': '민수기', 'Deuteronomy': '신명기',
  'Joshua': '여호수아', 'Judges': '사사기', 'Ruth': '룻기', '1 Samuel': '사무엘상', '2 Samuel': '사무엘하',
  '1 Kings': '열왕기상', '2 Kings': '열왕기하', '1 Chronicles': '역대상', '2 Chronicles': '역대하',
  'Ezra': '에스라', 'Nehemiah': '느헤미야', 'Esther': '에스더', 'Job': '욥기',
  'Psalm': '시편', 'Psalms': '시편', 'Proverbs': '잠언', 'Ecclesiastes': '전도서', 'Song of Solomon': '아가',
  'Isaiah': '이사야', 'Jeremiah': '예레미야', 'Lamentations': '예레미야 애가', 'Ezekiel': '에스겔',
  'Daniel': '다니엘', 'Hosea': '호세아', 'Joel': '요엘', 'Amos': '아모스', 'Obadiah': '오바댜',
  'Jonah': '요나', 'Micah': '미가', 'Nahum': '나훔', 'Habakkuk': '하박국', 'Zephaniah': '스바냐',
  'Haggai': '학개', 'Zechariah': '스가랴', 'Malachi': '말라기',
  'Matthew': '마태복음', 'Mark': '마가복음', 'Luke': '누가복음', 'John': '요한복음', 'Acts': '사도행전',
  'Romans': '로마서', '1 Corinthians': '고린도전서', '2 Corinthians': '고린도후서', 'Galatians': '갈라디아서',
  'Ephesians': '에베소서', 'Philippians': '빌립보서', 'Colossians': '골로새서',
  '1 Thessalonians': '데살로니가전서', '2 Thessalonians': '데살로니가후서', '1 Timothy': '디모데전서',
  '2 Timothy': '디모데후서', 'Titus': '디도서', 'Philemon': '빌레몬서', 'Hebrews': '히브리서',
  'James': '야고보서', '1 Peter': '베드로전서', '2 Peter': '베드로후서', '1 John': '요한일서',
  '2 John': '요한이서', '3 John': '요한삼서', 'Jude': '유다서', 'Revelation': '요한계시록'
};

export const bookCodeMap: Record<string, string> = {
  'Genesis': 'gen', 'Exodus': 'exo', 'Leviticus': 'lev', 'Numbers': 'num', 'Deuteronomy': 'deu',
  'Joshua': 'jos', 'Judges': 'jdg', 'Ruth': 'rut', '1 Samuel': '1sa', '2 Samuel': '2sa',
  '1 Kings': '1ki', '2 Kings': '2ki', '1 Chronicles': '1ch', '2 Chronicles': '2ch',
  'Ezra': 'ezr', 'Nehemiah': 'neh', 'Esther': 'est', 'Job': 'job',
  'Psalm': 'psa', 'Psalms': 'psa', 'Proverbs': 'pro', 'Ecclesiastes': 'ecc', 'Song of Solomon': 'sng',
  'Isaiah': 'isa', 'Jeremiah': 'jer', 'Lamentations': 'lam', 'Ezekiel': 'ezk',
  'Daniel': 'dan', 'Hosea': 'hos', 'Joel': 'jol', 'Amos': 'amo', 'Obadiah': 'oba',
  'Jonah': 'jnh', 'Micah': 'mic', 'Nahum': 'nam', 'Habakkuk': 'hab', 'Zephaniah': 'zep',
  'Haggai': 'hag', 'Zechariah': 'zec', 'Malachi': 'mal',
  'Matthew': 'mat', 'Mark': 'mrk', 'Luke': 'luk', 'John': 'jhn', 'Acts': 'act',
  'Romans': 'rom', '1 Corinthians': '1co', '2 Corinthians': '2co', 'Galatians': 'gal',
  'Ephesians': 'eph', 'Philippians': 'php', 'Colossians': 'col',
  '1 Thessalonians': '1th', '2 Thessalonians': '2th', '1 Timothy': '1ti',
  '2 Timothy': '2ti', 'Titus': 'tit', 'Philemon': 'phm', 'Hebrews': 'heb',
  'James': 'jas', '1 Peter': '1pe', '2 Peter': '2pe', '1 John': '1jn',
  '2 John': '2jn', '3 John': '3jn', 'Jude': 'jud', 'Revelation': 'rev'
};

export interface ReadingPassage {
  text: string;
  gaeLink: string;
  saeHangeulLink: string;
}

export const isLeapYear = (year: number) => {
  return new Date(year, 1, 29).getDate() === 29;
};

export const isLeapDay = (date: Date) => {
  return date.getMonth() === 1 && date.getDate() === 29;
};

export const translatePassage = (passage: string): ReadingPassage => {
  const match = passage.trim().match(/^([1-3]?\s*[A-Za-z\s]+)(.*)$/);
  if (match) {
    const bookName = match[1].trim();
    const chapterAndVerses = match[2].trim();
    const koreanBookName = bookNameMap[bookName] || bookName;
    let translated = `${koreanBookName} ${chapterAndVerses}`.trim();
    if (/\d$/.test(translated)) {
      if (koreanBookName === '시편') {
        translated += '편';
      } else {
        translated += '장';
      }
    }

    const chapterMatch = chapterAndVerses.match(/^(\d+)/);
    const chapter = chapterMatch ? chapterMatch[1] : '1';
    const bookCode = bookCodeMap[bookName] || 'gen';
    const saeHangeulCode = bookCode === 'jnh' ? 'JON' : bookCode.toUpperCase();

    return {
      text: translated,
      gaeLink: `https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=${bookCode}&chap=${chapter}`,
      saeHangeulLink: `https://www.bskorea.or.kr/KNT/index.php?version=d7a4326402395391-01&abbr=engKJVCPB&chapter=${saeHangeulCode}.${chapter}`
    };
  }
  return {
    text: passage,
    gaeLink: 'https://www.bskorea.or.kr/bible/korbibReadpage.php',
    saeHangeulLink: 'https://www.bskorea.or.kr/KNT/index.php'
  };
};

export const getMcheynePlanIndex = (date: Date): number | null => {
  const dayOfYear = getDayOfYear(date);

  if (!isLeapYear(date.getFullYear())) {
    return dayOfYear - 1;
  }

  if (isLeapDay(date)) {
    return null;
  }

  const isAfterLeapDay = date.getMonth() > 1;
  return isAfterLeapDay ? dayOfYear - 2 : dayOfYear - 1;
};

export const getMcheyneReadingPlan = (date: Date): ReadingPassage[] => {
  try {
    if (typeof ReadingPlan !== 'function') {
      console.error('ReadingPlan is not a constructor. Check the bible-in-one-year package export.');
      return [];
    }

    const index = getMcheynePlanIndex(date);
    if (index === null) {
      return [];
    }

    const plan = new ReadingPlan('mcheyne');
    const readingsStr = plan.getDay(index);
    if (!readingsStr) return [];

    return readingsStr.split(',').map((p: string) => translatePassage(p));
  } catch (error) {
    console.error('Error getting reading plan:', error);
    return [];
  }
};
