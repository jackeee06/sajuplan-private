export type CategoryType = "타로" | "사주" | "신점";

export interface Counselor {
  id: number;
  name: string;
  code: string;
  subtitle: string;
  type: CategoryType;
  price: string;
  description: string;
  rating: number;
  reviews: number;
  image: string;
  favorited: boolean;
  hasChat: boolean;
  experience: string;
  specialties: string[];
  bio: string;
}

export const typeColors: Record<CategoryType, string> = {
  사주: "#3f5b51",
  신점: "#c47c7c",
  타로: "#7ca4c4",
};

export const counselors: Counselor[] = [
  {
    id: 1,
    name: "강도사",
    code: "118131",
    subtitle: "경청이 답이다",
    type: "사주",
    price: "1,000",
    description: "경청이 우선, 마음의 소리",
    rating: 4.8,
    reviews: 152,
    image:
      "https://images.unsplash.com/photo-1545696968-1a5245650b36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbiUyMHBvcnRyYWl0JTIwZnJpZW5kbHklMjBzbWlsZXxlbnwxfHx8fDE3NzYyNDI2MDd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    favorited: false,
    hasChat: false,
    experience: "15년",
    specialties: ["사주팔자", "궁합", "운세"],
    bio: "15년 경력의 사주 전문 상담사입니다. 경청을 바탕으로 내담자의 마음에 공감하며, 정확한 사주 해석으로 인생의 방향을 제시합니다.",
  },
  {
    id: 2,
    name: "김선녀",
    code: "224587",
    subtitle: "마음을 읽는 신점",
    type: "신점",
    price: "1,500",
    description: "정확한 신점, 따뜻한 상담",
    rating: 4.9,
    reviews: 328,
    image:
      "https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHdvbWFuJTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzc2MTU3NTEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    favorited: true,
    hasChat: true,
    experience: "20년",
    specialties: ["신점", "작명", "택일"],
    bio: "20년 이상의 경험으로 정확한 신점 상담을 제공합니다. 따뜻한 마음으로 고민을 함께 나누겠습니다.",
  },
  {
    id: 3,
    name: "이타로",
    code: "335912",
    subtitle: "카드가 알려주는 길",
    type: "타로",
    price: "1,000",
    description: "정밀 타로, 미래를 읽다",
    rating: 4.7,
    reviews: 89,
    image:
      "https://images.unsplash.com/photo-1667184763638-a666fc90ece2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb3J0dW5lJTIwdGVsbGVyJTIwc3Bpcml0dWFsJTIwYWR2aXNvciUyMHBvcnRyYWl0fGVufDF8fHx8MTc3NjI0MjYwMnww&ixlib=rb-4.1.0&q=80&w=1080",
    favorited: false,
    hasChat: true,
    experience: "8년",
    specialties: ["타로", "연애운", "진로"],
    bio: "타로 카드를 통해 당신의 현재와 미래를 읽어드립니다. 연애, 진로, 재물 등 다양한 분야의 상담이 가능합니다.",
  },
  {
    id: 4,
    name: "박철학",
    code: "441290",
    subtitle: "명리학의 대가",
    type: "사주",
    price: "2,000",
    description: "깊이 있는 사주 풀이",
    rating: 4.6,
    reviews: 201,
    image:
      "https://images.unsplash.com/photo-1545696968-1a5245650b36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMG1hbiUyMHBvcnRyYWl0JTIwZnJpZW5kbHklMjBzbWlsZXxlbnwxfHx8fDE3NzYyNDI2MDd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    favorited: false,
    hasChat: true,
    experience: "25년",
    specialties: ["사주", "관상", "풍수"],
    bio: "25년 명리학 연구와 상담 경력. 사주팔자, 관상, 풍수 등 전통 역학 전반에 깊은 조예를 가지고 있습니다.",
  },
  {
    id: 5,
    name: "최영매",
    code: "557823",
    subtitle: "영혼의 메신저",
    type: "신점",
    price: "1,800",
    description: "진심 어린 신점 상담",
    rating: 4.5,
    reviews: 176,
    image:
      "https://images.unsplash.com/photo-1581065178026-390bc4e78dad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc2lhbiUyMHdvbWFuJTIwcG9ydHJhaXQlMjBwcm9mZXNzaW9uYWx8ZW58MXx8fHwxNzc2MTU3NTEyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    favorited: false,
    hasChat: false,
    experience: "18년",
    specialties: ["신점", "귀신상담", "액막이"],
    bio: "18년 신점 경력의 영매. 진심 어린 상담으로 여러분의 고민을 해결해 드립니다.",
  },
];

export const bannerImages = [
  "https://images.unsplash.com/photo-1612323272388-34fe470bedad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxteXN0aWNhbCUyMHRhcm90JTIwY2FyZHMlMjBwdXJwbGV8ZW58MXx8fHwxNzc2MjQyNjAxfDA&ixlib=rb-4.1.0&q=80&w=1080",
  "https://images.unsplash.com/photo-1615829332206-22479388eecc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YXJvdCUyMHJlYWRpbmclMjBjYW5kbGVsaWdodCUyMG15c3RpY3xlbnwxfHx8fDE3NzYyNDI4OTl8MA&ixlib=rb-4.1.0&q=80&w=1080",
  "https://images.unsplash.com/photo-1631222958324-aeddd0bf4b53?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc3Ryb2xvZ3klMjB6b2RpYWMlMjBzdGFycyUyMG5pZ2h0fGVufDF8fHx8MTc3NjI0Mjg5OXww&ixlib=rb-4.1.0&q=80&w=1080",
];
