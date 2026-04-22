export type ProfileOverviewSection<TSectionKey extends string = string> = {
  key: TSectionKey
  title: string
  isComplete: boolean
}

export function getDefaultOpenProfileSections<TSectionKey extends string>(
  sections: readonly ProfileOverviewSection<TSectionKey>[],
  recentKeys: readonly TSectionKey[] = [],
): TSectionKey[] {
  const openKeys = new Set<TSectionKey>()
  const knownKeys = new Set(sections.map((section) => section.key))

  for (const section of sections) {
    if (!section.isComplete) {
      openKeys.add(section.key)
    }
  }

  for (const key of recentKeys) {
    if (knownKeys.has(key)) {
      openKeys.add(key)
    }
  }

  const orderedKeys = sections.map((section) => section.key).filter((key) => openKeys.has(key))

  if (orderedKeys.length > 0) {
    return orderedKeys
  }

  return sections[0] ? [sections[0].key] : []
}

export function getProfileOverviewSummary<TSectionKey extends string>(
  sections: readonly ProfileOverviewSection<TSectionKey>[],
) {
  const completeCount = sections.filter((section) => section.isComplete).length
  const nextSection = sections.find((section) => !section.isComplete) ?? null

  return {
    completeCount,
    totalCount: sections.length,
    allComplete: sections.length > 0 && completeCount === sections.length,
    nextSection,
  }
}
