import React from 'react';
import { Sparkles } from 'lucide-react';
import { useSchoolIdentity } from './identity';

/** Badge, title and paragraph for the /next intro once the school flag is on. */
export default function SchoolIdentityHeroCopy() {
  const { identity } = useSchoolIdentity();
  return (
    <>
      <span className="mb-5 inline-flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-sm font-black text-emerald-950">
        <Sparkles size={18} />
        {identity.nameEn} · {identity.verseRef}
      </span>
      <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-emerald-950 sm:text-5xl">
        {identity.name}
      </h1>
      <p className="mt-4 text-base font-bold text-emerald-800">“{identity.motto}”</p>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">{identity.description}</p>
    </>
  );
}
