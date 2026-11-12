import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { parseTodayWordDate, resolveTodayWordDate, todayWordDateKey } from '../src/lib/todayWordDate';

describe('묵상 날짜와 미래 미리보기', () => {
  it('미인증/일반 사용자의 미래 URL은 오늘로 제한한다', () => {
    expect(format(resolveTodayWordDate('2026-10-29', false, '2026-10-28'), 'yyyy-MM-dd')).toBe('2026-10-28');
    expect(format(resolveTodayWordDate('2026-10-27', false, '2026-10-28'), 'yyyy-MM-dd')).toBe('2026-10-27');
  });
  it('관리자는 동일한 날짜 키로 미래 가이드를 조회한다', () => {
    expect(format(resolveTodayWordDate('2026-10-29', true, '2026-10-28'), 'yyyy-MM-dd')).toBe('2026-10-29');
  });
  it('역할이 해제되면 같은 미래 URL도 오늘로 제한한다', () => {
    const date = '2026-10-29';
    expect(format(resolveTodayWordDate(date, true, '2026-10-28'), 'yyyy-MM-dd')).toBe(date);
    expect(format(resolveTodayWordDate(date, false, '2026-10-28'), 'yyyy-MM-dd')).toBe('2026-10-28');
  });
  it.each([null, undefined, '', '2026-02-29', '2026-13-01', '2026-10-29T00:00:00+09:00', '<script>'])('없는/잘못된 날짜 %s는 명시 날짜로 표시하지 않는다', value => {
    expect(todayWordDateKey(value)).toBeNull();
    expect(format(resolveTodayWordDate(value, true, '2026-10-28'), 'yyyy-MM-dd')).toBe('2026-10-28');
  });
  it('날짜 문자열은 시각이나 UTC 변환 없이 현지 달력 날짜로 유지한다', () => {
    for (const timezone of ['Asia/Seoul', 'America/Los_Angeles', 'UTC']) {
      const previous = process.env.TZ;
      try {
        process.env.TZ = timezone;
        const date = parseTodayWordDate('2026-10-29')!;
        expect(format(date, 'yyyy-MM-dd')).toBe('2026-10-29');
        expect(date.getHours()).toBe(0);
        expect(todayWordDateKey('2026-10-29')).toBe('2026-10-29');
      } finally {
        if (previous === undefined) delete process.env.TZ;
        else process.env.TZ = previous;
      }
    }
  });
});
