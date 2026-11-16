import { useState, type FormEvent } from "react";
import type { HumanMemory } from "../../domain/archive";

interface MemoryAnnotationProps {
  onComplete(memory: HumanMemory): void;
}

const emotions = ["怀念", "归属", "温暖", "遗憾", "疏离", "陌生"];

export function MemoryAnnotation({ onComplete }: MemoryAnnotationProps) {
  const [text, setText] = useState("");
  const [relation, setRelation] = useState("日常使用");
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const length = Array.from(text.trim()).length;

  const toggleEmotion = (tag: string) => {
    setEmotionTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : current.length < 3
          ? [...current, tag]
          : current,
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (length < 20 || length > 400) return;
    onComplete({ text: text.trim(), relation, emotionTags });
  };

  return (
    <section className="creation-stage memory-stage" aria-labelledby="memory-title">
      <div className="stage-index">03 / 人类补述</div>
      <div className="stage-copy">
        <h2 id="memory-title">你记得的，不必像资料</h2>
        <p>机器描述物件表面，你补充它与人的关系。无法确认的部分可以留白。</p>
      </div>
      <form onSubmit={submit} className="memory-form">
        <label>
          <span>这件物品与你有什么关系？</span>
          <select value={relation} onChange={(event) => setRelation(event.target.value)}>
            <option>日常使用</option>
            <option>家人留下</option>
            <option>偶然发现</option>
            <option>收藏保存</option>
            <option>关系不确定</option>
          </select>
        </label>
        <label>
          <span>写下一段真实记忆</span>
          <textarea
            rows={6}
            value={text}
            maxLength={400}
            onChange={(event) => setText(event.target.value)}
            placeholder="它曾在哪里出现？谁会使用它？为什么今天还留着？"
          />
          <small className={length > 0 && length < 20 ? "field-warning" : ""}>
            {length} / 400，至少 20 个字符
          </small>
        </label>
        <fieldset>
          <legend>最多选择三个情绪</legend>
          <div className="emotion-grid">
            {emotions.map((tag) => (
              <label key={tag}>
                <input
                  type="checkbox"
                  checked={emotionTags.includes(tag)}
                  disabled={!emotionTags.includes(tag) && emotionTags.length >= 3}
                  onChange={() => toggleEmotion(tag)}
                />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="creation-primary" type="submit" disabled={length < 20 || length > 400}>
          保存这段记忆
        </button>
      </form>
    </section>
  );
}
