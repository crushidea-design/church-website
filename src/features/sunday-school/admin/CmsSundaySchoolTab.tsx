// Admin-only CMS tab for preparing the 2027 Sunday school renewal.
import React from 'react';
import { useSundaySchoolCatalog } from '../api';
import SundaySchoolStatusSection from './SundaySchoolStatusSection';
import SundaySchoolTermsSection from './SundaySchoolTermsSection';
import SundaySchoolCurriculumSection from './SundaySchoolCurriculumSection';
import SundaySchoolClassesSection from './SundaySchoolClassesSection';
import SundaySchoolPreparationSection from './SundaySchoolPreparationSection';
import SundaySchoolPrivatePostsSection from './SundaySchoolPrivatePostsSection';
import SundaySchoolTransitionSection from './SundaySchoolTransitionSection';

export default function CmsSundaySchoolTab() {
  const catalog = useSundaySchoolCatalog();
  // Editing defaults that are not stored yet would create a partial collection.
  const termsLocked = catalog.loading || catalog.fallback.terms;
  const curriculumLocked = catalog.loading || catalog.fallback.curriculum || catalog.fallback.terms;
  const classesLocked = catalog.loading || catalog.fallback.classes;

  return (
    <div className="space-y-4">
      <SundaySchoolStatusSection catalog={catalog} />
      <SundaySchoolTermsSection terms={catalog.terms} disabled={termsLocked} />
      <SundaySchoolCurriculumSection terms={catalog.terms} curriculum={catalog.curriculum} disabled={curriculumLocked} />
      <SundaySchoolClassesSection classes={catalog.classes} disabled={classesLocked} />
      <SundaySchoolPreparationSection />
      <SundaySchoolPrivatePostsSection />
      <SundaySchoolTransitionSection catalog={catalog} />
    </div>
  );
}
