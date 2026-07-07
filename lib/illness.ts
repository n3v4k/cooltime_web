import { IllnessType } from "./types";

export interface IllnessGuideEntry {
  type: Exclude<IllnessType, null>;
  severity: "emergency" | "caution";
  symptoms: string;
  treatment: string;
}

export const ILLNESS_GUIDE: IllnessGuideEntry[] = [
  {
    type: "열사병",
    severity: "emergency",
    symptoms:
      "체온조절 중추 기능 상실로 체온이 40℃ 이상 치솟음, 피부가 건조하고 뜨거움, 의식장애·혼수 동반 가능",
    treatment:
      "즉시 119 신고 + 시원한 장소로 이동, 옷을 헐렁하게 하고 몸을 물수건 등으로 식히며 병원 이송이 최우선",
  },
  {
    type: "열탈진",
    severity: "caution",
    symptoms:
      "체온 37~40℃, 땀을 많이 흘리고 피부는 차갑고 축축하며 창백함, 두통·어지럼증·메스꺼움·무기력감",
    treatment:
      "그늘/에어컨이 있는 곳으로 옮겨 눕히고 다리를 높게, 의식이 있고 구토가 없으면 물·이온음료 섭취, 1시간 내 회복 안 되면 병원 이송",
  },
  {
    type: "열경련",
    severity: "caution",
    symptoms:
      "땀으로 염분·칼륨·마그네슘이 손실되어 종아리·허벅지·어깨 등 근육경련 발생",
    treatment:
      "시원한 곳에서 휴식, 수분·이온음료 보충, 경련 부위 마사지 (경련이 멈춰도 바로 작업 복귀 금지, 충분히 휴식)",
  },
  {
    type: "열실신",
    severity: "caution",
    symptoms:
      "체표면 혈액이 늘고 심부 혈액량이 줄어 뇌 혈류 부족으로 일시적 의식소실, 오래 서 있다 갑자기 일어날 때 주로 발생",
    treatment: "그늘에 눕히고 다리를 심장보다 높게, 의식 회복 확인 후 충분한 휴식과 수분 보충",
  },
  {
    type: "열부종",
    severity: "caution",
    symptoms: "더운 환경에서 손·발 등이 붓는 비교적 경미한 증상",
    treatment: "부은 부위를 심장보다 높게 올리고 휴식, 증상이 지속되면 병원 진료",
  },
];

export function getGuide(type: Exclude<IllnessType, null>) {
  return ILLNESS_GUIDE.find((g) => g.type === type)!;
}

// 3문항 자가진단 로직 (섹션 5-1)
export type DiagnosisAnswer = "yes" | "no";

export interface DiagnosisStep {
  id: "q1" | "q2" | "q3";
  question: string;
  options: { label: string; value: string }[];
}

export const Q1: DiagnosisStep = {
  id: "q1",
  question: "의식이 흐릿하거나 없나요?",
  options: [
    { label: "예", value: "yes" },
    { label: "아니오", value: "no" },
  ],
};

export const Q2: DiagnosisStep = {
  id: "q2",
  question: "피부가 차갑고 축축한가요, 아니면 근육 경련이 있나요?",
  options: [
    { label: "차갑고 축축함", value: "cold_wet" },
    { label: "근육 경련", value: "cramp" },
    { label: "둘 다 아님", value: "none" },
  ],
};

export const Q3: DiagnosisStep = {
  id: "q3",
  question: "서있다가 갑자기 어지러워 쓰러졌나요, 아니면 손발이 부었나요?",
  options: [
    { label: "쓰러짐", value: "fainted" },
    { label: "손발이 부음", value: "swollen" },
    { label: "해당 없음", value: "none" },
  ],
};

export function resolveDiagnosis(answers: {
  q1?: string;
  q2?: string;
  q3?: string;
}): { type: IllnessType; uncertain: boolean } {
  if (answers.q1 === "yes") {
    return { type: "열사병", uncertain: false };
  }
  if (answers.q2 === "cold_wet") return { type: "열탈진", uncertain: false };
  if (answers.q2 === "cramp") return { type: "열경련", uncertain: false };
  if (answers.q3 === "fainted") return { type: "열실신", uncertain: false };
  if (answers.q3 === "swollen") return { type: "열부종", uncertain: false };
  return { type: null, uncertain: true };
}
