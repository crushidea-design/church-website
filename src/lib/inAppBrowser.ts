const IN_APP_BROWSER_PATTERNS = [
  /KAKAOTALK/i,
  /FBAN/i,
  /FBAV/i,
  /Instagram/i,
  /Line/i,
  /NAVER\(inapp/i,
  /wv\)/i,
];

export function getUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

export function isInAppBrowser(userAgent = getUserAgent()): boolean {
  if (!userAgent) return false;
  return IN_APP_BROWSER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function isKakaoInAppBrowser(userAgent = getUserAgent()): boolean {
  return /KAKAOTALK/i.test(userAgent);
}

export function getInAppBrowserLoginMessage(userAgent = getUserAgent()): string {
  if (isKakaoInAppBrowser(userAgent)) {
    return '카카오톡 안에서는 Google 로그인이 차단됩니다. 오른쪽 위 메뉴에서 기본 브라우저로 연 뒤 다시 로그인해 주세요.';
  }

  if (isInAppBrowser(userAgent)) {
    return '앱 안 브라우저에서는 Google 로그인이 차단될 수 있습니다. Safari나 Chrome 같은 기본 브라우저에서 다시 열어 로그인해 주세요.';
  }

  return '';
}
