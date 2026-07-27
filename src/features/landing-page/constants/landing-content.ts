/**
 * Figma 전체 페이지와 구현 기획에서 확정한 랜딩 페이지의 정적 콘텐츠다.
 *
 * 공개 전 확인 대상으로 분류된 표현도 소유자 확인 전에는 원문을 유지한다.
 */
export const LANDING_CONTENT = {
  brandName: "4대보험경정청구센터",
  brandNameParts: {
    base: "4대보험",
    emphasis: "경정청구센터",
  },
  navigationCallToActionLabel: "무료 진단 신청",
  navigation: [
    { label: "센터 소개", href: "#about" },
    { label: "주요 서비스", href: "#services" },
    { label: "전문가 강점", href: "#strengths" },
    { label: "환급 절차", href: "#process" },
  ],
  hero: {
    heading: {
      firstLine: "대표님! 더 낸 4대보험료(세금)",
      highlightedText: "환급받을 권리",
      secondLineSuffix: "를",
      thirdLine: "절대 놓치지 마세요!",
    },
    descriptions: [
      "시간이 지나면 국고로 귀속되어 돌려받을 수 없습니다.",
      "복잡하고 까다로운 경정청구, 전문 노무사가 직접 개입하여 단 1원까지 확실하게 찾아드립니다.",
    ],
    phoneCtaLabel: "전화 상담",
    emailCtaLabel: "이메일 문의하기",
    consultationLabel: "상담시간",
    emailLabel: "이메일",
  },
  centerIntroduction: {
    heading: "센터 소개",
    description: "4대보험 전문가들이 고객의 권리를 지키고 최상의 결과와 위해 함께합니다.",
    membersHeading: "센터 구성원",
    members: [
      { name: "이관수", role: "노무사" },
      { name: "김민한", role: "노무사" },
      { name: "박설영", role: "노무사" },
      { name: "김상재", role: "노무사" },
      { name: "이정계", role: "행정사" },
      { name: "외 다수", role: null },
    ],
    directorHeading: "센터장 소개",
    directorName: "이관수",
    directorCredentials: [
      "성균관대 법학박사",
      "제15회 공인노무사 최연소합격(20년차)",
      "근로복지공단 지문위원",
      "한국공인노무사회 이사",
      "한국사회보장법학회 이사",
      "서경대 연구교수",
      "노무법인 권리 대표 공인노무사",
    ],
  },
  benefits: {
    heading: "왜 4대보험경정청구센터에서 환급받아야 할까요?",
    description: "사업주님의 소중한 권리, 전문 노무사의 체계적인 분석을 통해 돌려드립니다.",
    items: [
      {
        assetKey: "hiddenPremium",
        title: "숨은 보험료 진단",
        description:
          "인지하지 못했던 과오납 4대보험료를\n법률적 근거에 기반하여 정확하게 진단합니다.",
      },
      { assetKey: "laborAttorneyReview", title: "노무사 직접 검토" },
      { assetKey: "maximumRefund", title: "최대 환급 보장" },
      { assetKey: "aftercare", title: "철저한 사후관리" },
    ],
  },
  refundCases: {
    heading: "기업의 4대보험 환급을 함께합니다.",
    description:
      "국내 다양한 업종의 기업과 함께 4대보험 경정청구를 진행하며, 숨은 환급금을 찾아드리고 있습니다.",
    items: [
      {
        assetKey: "office",
        industry: "제조업",
        company: "(주)삼**",
        amount: "₩127,663,492",
      },
      {
        assetKey: "construction",
        industry: "건설업",
        company: "(주)케**",
        amount: "₩75,410,246",
      },
      { assetKey: "service", industry: "서비스업", company: "하**", amount: "₩62,768,010" },
      { assetKey: "records", industry: "제조업", company: "(주)태**", amount: "₩329,644,006" },
      { assetKey: "office", industry: "제조업", company: "**제약", amount: "₩85,925,244" },
      {
        assetKey: "construction",
        industry: "서비스업",
        company: "코***",
        amount: "₩135,418,733",
      },
      { assetKey: "service", industry: "도소매업", company: "(주)민**", amount: "₩45,285,402" },
      {
        assetKey: "records",
        industry: "아웃소싱업",
        company: "(주)우*",
        amount: "₩363,490,402",
      },
    ],
  },
  expertStrengths: {
    eyebrow: "복잡한 4대보험 환급,",
    heading: "전문가는 다릅니다!",
    description:
      "단순 대행이 아닌, 법률적 리스크를 원천\n차단하고 가장 안전한 방식으로 최대의 혜택을\n돌려드리는 것이 저희의 사명입니다.",
    items: [
      {
        id: "remote-consultation",
        step: "01",
        iconKey: "globe",
        assetKey: "remoteConsultation",
        layout: "image-left",
        title: "비대면 전국 상담",
        description:
          "전국 어디서나 지역 제한 없이\n간편하게 비대면으로 상담 및\n서류 접수가 가능합니다.",
      },
      {
        id: "success-fee",
        step: "02",
        iconKey: "percent",
        assetKey: "successFee",
        layout: "image-right",
        title: "성공 보수형 수수료",
        description:
          "환급 성공 시에만 수수료가 발생하며,\n사전 착수금이나 진행 비용은\n전혀 없습니다.",
      },
      {
        id: "security",
        step: "03",
        iconKey: "lock",
        assetKey: "security",
        layout: "image-left",
        title: "100% 정보 보안",
        description:
          "제출해주신 모든 기업 정보와\n개인정보는 암호화되어 철저하게\n보안 관리됩니다.",
      },
    ],
  },
  refundProcess: {
    heading: "이렇게 진행합니다!",
    description: "신속하고 정확하게, 사업주님의 부담을 최소화하는 프로세스입니다.",
    steps: [
      {
        id: "consultation",
        number: "1",
        assetKey: "consultation",
        title: "상담 및 접수",
        descriptionParts: [
          { text: "전화", highlighted: true },
          { text: " 또는 " },
          { text: "이메일", highlighted: true },
          { text: "로 문의 접수" },
        ],
      },
      {
        id: "analysis",
        number: "2",
        assetKey: "analysis",
        title: "진단 및 분석",
        descriptionParts: [
          { text: "분석하여 환급 가능 " },
          { text: "금액 진단", highlighted: true },
        ],
      },
      {
        id: "documents",
        number: "3",
        assetKey: "documents",
        title: "서류 안내 및 진행",
        descriptionParts: [
          { text: "필요 서류 ", highlighted: true },
          { text: "안내 및 " },
          { text: "환급 신청", highlighted: true },
          { text: " 대행" },
        ],
      },
      {
        id: "refund-complete",
        number: "4",
        assetKey: "refundComplete",
        title: "환급 완료",
        descriptionParts: [
          { text: "심사 후 " },
          { text: "환급금 입금", highlighted: true },
          { text: " 및 " },
          { text: "결과 안내", highlighted: true },
        ],
      },
    ],
    aftercareHeading: "사후관리 컨설팅",
    aftercareDescription: "환급 완료 후 재발 방지 대책 수립 및 맞춤형 절세 방안을 제안합니다.",
  },
  contact: {
    notice: "소멸시효 3년 경과 전 빠른 신청 필수!",
    heading: "지금 바로 무료 진단을 신청하세요!",
    descriptions: [
      "환급 가능 여부는 무료로 확인해 드립니다.",
      "지금이 환급을 받을 수 있는 가장 빠른 기회입니다.",
    ],
    phoneLabel: "빠른 전화 상담",
    emailLabel: "이메일 서류 접수 및 문의",
  },
  footer: {
    serviceNotice: "본 서비스는 공인노무사가 직접 검토하고 진행하는 전문 법률 서비스입니다.",
    copyright: "© 2026 4대보험경정청구센터. All Rights Reserved.",
    producer: "Powered by MINING5000",
    address: "서울특별시 강남구 역삼로 67길 15 케희빌딩 2층 (대치동 900-16)",
    businessName: "4대보험경정청구센터",
    representative: "이관수",
    privacyOfficer: "이관수",
    businessRegistrationNumber: "249-81-03649",
  },
} as const;
