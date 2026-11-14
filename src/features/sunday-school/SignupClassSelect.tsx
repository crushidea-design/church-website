import React from 'react';
import { useSundaySchoolCatalog } from './api';
import { useSundaySchool2027Flag } from './flags';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Optional class picker for students at sign-up. Shown only after the 2027 switch. */
export default function SignupClassSelect({ value, onChange }: Props) {
  const flag = useSundaySchool2027Flag();
  const { classes } = useSundaySchoolCatalog();
  if (!flag.enabled) return null;

  const visible = classes.filter((item) => item.isVisible);
  return (
    <div className="mt-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        주일학교 반 <span className="text-gray-400 text-xs">(선택)</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm bg-white"
      >
        <option value="">잘 모르겠어요</option>
        {visible.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}{item.ageRule ? ` · ${item.ageRule}` : ''}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-gray-500">교역자가 승인할 때 반을 확인해 배정합니다.</p>
    </div>
  );
}
