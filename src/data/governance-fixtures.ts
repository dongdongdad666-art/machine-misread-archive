import type { ArchiveItem } from "../domain/archive";
import { seedArchives } from "./seed-archives";

export interface GovernanceArchiveItem extends ArchiveItem {
  consentVersion: "publication-v1";
  submittedAt: string;
  withdrawalRequestedAt?: string;
}

export interface ModerationEvent {
  id: string;
  archiveItemId: string;
  decision: "approve" | "reject" | "request_change" | "withdraw";
  reasonCodes: string[];
  note: string;
  actorLabel: string;
  createdAt: string;
}

export interface GovernanceRecord {
  item: GovernanceArchiveItem;
  riskFlags: string[];
  moderationEvents: ModerationEvent[];
}

export interface GovernanceCollection {
  id: string;
  title: string;
  thesis: string;
  itemIds: string[];
}

const [ticket, keys, dictionary] = seedArchives;

export const governanceRecords: GovernanceRecord[] = [
  {
    item: {
      ...dictionary,
      status: "pending_review",
      sourceVisibility: "private",
      artifactVisibility: "public_requested",
      consentVersion: "publication-v1",
      submittedAt: "2026-09-10T14:24:00+08:00",
    },
    riskFlags: ["可见文字需复核"],
    moderationEvents: [],
  },
  {
    item: {
      ...keys,
      status: "pending_review",
      sourceVisibility: "private",
      artifactVisibility: "public_requested",
      consentVersion: "publication-v1",
      submittedAt: "2026-09-10T13:08:00+08:00",
    },
    riskFlags: [],
    moderationEvents: [
      {
        id: "event-keys-returned",
        archiveItemId: keys.id,
        decision: "request_change",
        reasonCodes: ["context-missing"],
        note: "请补充钥匙与门锁关系；若确实未知，可明确选择“关系不确定”。",
        actorLabel: "内容审核 / 原型记录",
        createdAt: "2026-09-09T16:40:00+08:00",
      },
    ],
  },
  {
    item: {
      ...ticket,
      status: "published",
      sourceVisibility: "private",
      artifactVisibility: "public",
      consentVersion: "publication-v1",
      submittedAt: "2026-09-10T11:42:00+08:00",
      withdrawalRequestedAt: "2026-09-10T15:02:00+08:00",
    },
    riskFlags: ["待处理撤回"],
    moderationEvents: [
      {
        id: "event-ticket-approved",
        archiveItemId: ticket.id,
        decision: "approve",
        reasonCodes: [],
        note: "来源说明完整，可进入专题候选。",
        actorLabel: "内容审核 / 原型记录",
        createdAt: "2026-09-10T12:10:00+08:00",
      },
    ],
  },
];

export const governanceCollections: GovernanceCollection[] = [
  {
    id: "collection-homebound-tickets",
    title: "回家的票据",
    thesis: "从纸质凭证观察城市通勤、返乡与制度迁移，只收录来源与地点边界清楚的记录。",
    itemIds: [ticket.id],
  },
  {
    id: "collection-doors-no-longer-open",
    title: "打不开的门",
    thesis: "保留钥匙仍在、对应空间却已丢失的关系空缺，不用生成叙事补写未知部分。",
    itemIds: [keys.id],
  },
];
