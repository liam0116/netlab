import type { QuizFactory } from '@/types/tutorial'
import { makeChoice, randInt, staticQuiz } from '@/utils/quiz'
import { MIN_DISKS, raidInfo, type RaidLevel } from '@/utils/raid'

const pick = <T>(items: T[]): T => items[randInt(0, items.length - 1)]!

function randomArray(levels: RaidLevel[]): { level: RaidLevel; disks: number; size: number } {
  const level = pick(levels)
  let disks = randInt(MIN_DISKS[level], 8)
  if (level === 10 && disks % 2) disks++
  if (level === 1) disks = 2
  return { level, disks, size: pick([2, 4, 8, 12, 16]) }
}

/** Usable capacity with fresh numbers every attempt. */
export const raidCapacityQuiz: QuizFactory = (t) => {
  const { level, disks, size } = randomArray([1, 5, 6, 10])
  const usable = raidInfo(level, disks, size).usableTB
  // The classic mistakes first (forgetting parity, forgetting the mirror…), then plain multiples so that
  // small arrays (e.g. RAID 1 with 2 disks) still get three distinct wrong answers.
  const mistakes = [disks * size, (disks - 1) * size, (disks - 2) * size, (disks * size) / 2]
  const fillers = Array.from({ length: disks + 3 }, (_, k) => (k + 1) * size)
  return makeChoice(
    t('raidPage.quiz.capacityQ', { level, disks, size }),
    `${usable} TB`,
    [...mistakes, ...fillers].filter((c) => c > 0 && c !== usable).map((c) => `${c} TB`),
    t(`raidPage.quiz.capacityExp${level}`, { disks, size, usable }),
  )
}

/** How many disks may fail. */
export const raidToleranceQuiz: QuizFactory = (t) => {
  const { level, disks } = randomArray([0, 5, 6, 10])
  const n = raidInfo(level, disks, 1).tolerance
  return makeChoice(
    t('raidPage.quiz.toleranceQ', { level, disks }),
    t('raidPage.quiz.disksN', { n }),
    [0, 1, 2, 3, disks - 1].map((x) => t('raidPage.quiz.disksN', { n: x })),
    t(`raidPage.quiz.toleranceExp${level}`),
  )
}

export const raidQuiz: QuizFactory[] = [raidCapacityQuiz, raidToleranceQuiz, staticQuiz('raidBigHdd'), staticQuiz('raidDatabase'), staticQuiz('raidBackup')]
