import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CONTENTS, getContentById } from '@/data';
import type { LearningContent } from '@/data/types';

interface SelectionContextValue {
  selected: LearningContent;
  select: (id: string) => void;
}

/** 未選択のときは先頭アイテム (スパイク音声つき) を表示しておく */
const SelectionContext = createContext<SelectionContextValue>({
  selected: CONTENTS[0],
  select: () => {},
});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string>(CONTENTS[0].id);
  const value = useMemo<SelectionContextValue>(
    () => ({
      selected: getContentById(selectedId) ?? CONTENTS[0],
      select: setSelectedId,
    }),
    [selectedId]
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  return useContext(SelectionContext);
}
