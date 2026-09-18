import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

type ScheduledItem = { id: string; title: string; status: string };
const labels: Record<string, string> = {
  pending: '예약 대기', processing: '발송 처리 중 · 오래 지속되면 확인 필요',
  sent: '발송 완료', failed: '발송 실패', needs_review: '발송 결과 확인 필요',
};

export default function ScheduledNotificationStatus() {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => onSnapshot(query(collection(db, 'scheduled_notifications'), orderBy('createdAt', 'desc'), limit(20)),
    (snapshot) => {
      setError(false);
      setItems(snapshot.docs.map((doc) => ({ id: doc.id, title: String(doc.data().title || ''), status: String(doc.data().status || '') })));
    }, () => setError(true)), []);
  return <section className="rounded-2xl border border-wood-200 bg-white p-5" aria-label="최근 예약 알림">
    <h2 className="font-semibold text-wood-900">최근 예약 알림</h2>
    <p className="mt-2 text-xs text-wood-600">결과 확인이 필요한 알림은 중복 발송을 막기 위해 자동 재발송하지 않습니다. 수신 여부를 확인한 뒤 필요할 때만 새 알림을 보내 주세요.</p>
    {error ? <p role="alert" className="mt-3 text-sm">예약 상태를 불러오지 못했습니다.</p> :
      items.length === 0 ? <p className="mt-3 text-sm text-wood-500">예약 알림이 없습니다.</p> :
        <ul className="mt-3 divide-y divide-wood-100">{items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
          <span>{item.title}</span><span className="text-wood-600">{labels[item.status] || item.status}</span>
        </li>)}</ul>}
  </section>;
}
