import React from 'react';

interface ArchiveIntroSectionProps {
  description: string;
  action?: React.ReactNode;
}

export default function ArchiveIntroSection({ description, action }: ArchiveIntroSectionProps) {
  return (
    <>
      <div className="mb-8 border-b border-wood-200 pb-6">
        <p className="text-lg text-wood-600">{description}</p>
      </div>

      {action && (
        <div className="flex justify-end">
          {action}
        </div>
      )}
    </>
  );
}
