import type { ArchiveItem, DisappearanceMode } from "../../domain/archive";

export interface ArchiveFilterValue {
  timeRange: string;
  emotion: string;
  disappearanceMode: "" | DisappearanceMode;
}

interface ArchiveFiltersProps {
  records: ArchiveItem[];
  value: ArchiveFilterValue;
  onChange(value: ArchiveFilterValue): void;
}

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "zh-CN"));

export function ArchiveFilters({ records, value, onChange }: ArchiveFiltersProps) {
  const timeRanges = unique(records.map((item) => item.timeRange));
  const emotions = unique(records.flatMap((item) => item.memory.emotionTags));
  const modes = unique(records.map((item) => item.disappearanceMode)) as DisappearanceMode[];

  return (
    <form className="archive-filters" aria-label="档案筛选" onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>年代线索</span>
        <select
          aria-label="按年代筛选"
          value={value.timeRange}
          onChange={(event) => onChange({ ...value, timeRange: event.target.value })}
        >
          <option value="">全部年代</option>
          {timeRanges.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>记忆情绪</span>
        <select
          aria-label="按情绪筛选"
          value={value.emotion}
          onChange={(event) => onChange({ ...value, emotion: event.target.value })}
        >
          <option value="">全部情绪</option>
          {emotions.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
      <label>
        <span>消失方式</span>
        <select
          aria-label="按消失方式筛选"
          value={value.disappearanceMode}
          onChange={(event) =>
            onChange({ ...value, disappearanceMode: event.target.value as ArchiveFilterValue["disappearanceMode"] })
          }
        >
          <option value="">全部方式</option>
          {modes.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    </form>
  );
}
