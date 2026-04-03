export const BIBLE_BOOKS = [
  "창세기", "출애굽기", "레위기", "민수기", "신명기", "여호수아", "사사기", "룻기", "사무엘상", "사무엘하", "열왕기상", "열왕기하", "역대상", "역대하", "에스라", "느헤미야", "에스더", "욥기", "시편", "잠언", "전도서", "아가", "이사야", "예레미야", "예레미야애가", "에스겔", "다니엘", "호세아", "요엘", "아모스", "오바댜", "요나", "미가", "나훔", "하박국", "스바냐", "학개", "스가랴", "말라기",
  "마태복음", "마가복음", "누가복음", "요한복음", "사도행전", "로마서", "고린도전서", "고린도후서", "갈라디아서", "에베소서", "빌립보서", "골로새서", "데살로니가전서", "데살로니가후서", "디모데전서", "디모데후서", "디도서", "빌레몬서", "히브리서", "야고보서", "베드로전서", "베드로후서", "요한1서", "요한2서", "요한3서", "유다서", "요한계시록"
];

export function generateSortOrder(title: string): number {
  if (!title) return 99000000;

  let bookIndex = 99; // 성경 책이 아닌 경우 기본값 (뒤로 배치)
  for (let i = 0; i < BIBLE_BOOKS.length; i++) {
    if (title.includes(BIBLE_BOOKS[i])) {
      bookIndex = i + 1;
      break;
    }
  }

  // 제목에서 숫자 추출 (예: "창세기 1장 2절" -> [1, 2])
  const numbers = title.match(/\d+/g);
  let chapter = 0;
  let verse = 0;

  if (numbers && numbers.length > 0) {
    chapter = parseInt(numbers[0], 10);
    if (numbers.length > 1) {
      verse = parseInt(numbers[1], 10);
    }
  }

  // 정렬 순서 계산: 책 번호(100만 단위) + 장(1000 단위) + 절
  return bookIndex * 1000000 + chapter * 1000 + verse;
}
