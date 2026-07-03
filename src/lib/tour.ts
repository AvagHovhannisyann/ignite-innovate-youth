// First-visit guided tour (driver.js). Anchors are data-tour attributes so
// the steps survive copy or layout changes. Steps whose anchor isn't in the
// DOM (e.g. desktop sidebar on mobile) are skipped automatically.
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const SEEN_KEY = "eyh-tour-v1";

const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Բարի գալուստ 🎉",
      description:
        "Սա քո անձնական հարթակն է․ 30 վայրկյանում ցույց կտանք գլխավորը։ Կարող ես բաց թողնել ցանկացած պահի։",
    },
  },
  {
    element: "[data-tour='nav-dashboard']",
    popover: {
      title: "Վահանակ",
      description: "Քո XP-ն, մակարդակը, AI առաջարկները և առաջիկա իրադարձությունները՝ մեկ էջում։",
    },
  },
  {
    element: "[data-tour='nav-schedule']",
    popover: {
      title: "Օրակարգ",
      description: "Իսկական օրացույց՝ ամիս/շաբաթ/օր/ցուցակ, drag-ով պլանավորում և Google/Apple համաժամեցում։",
    },
  },
  {
    element: "[data-tour='nav-opportunities']",
    popover: {
      title: "Հնարավորություններ",
      description: "Մրցույթներ, դասընթացներ, միջոցառումներ․ միացիր՝ և ամսաթվով իրադարձությունները կհայտնվեն օրակարգումդ։",
    },
  },
  {
    element: "[data-tour='nav-quests']",
    popover: {
      title: "Քվեստներ",
      description: "Կատարիր առաջադրանքներ, հավաքիր XP և բացիր նոր մակարդակներ ու նշաններ։",
    },
  },
  {
    element: "[data-tour='nav-agent']",
    popover: {
      title: "AI Օգնական",
      description:
        "Քո անձնական AI-ը․ կարող է պլան կազմել, օրակարգ խմբագրել, նախագիծ սկսել, նույնիսկ ադմինին հարց ուղարկել քո անունից։",
    },
  },
  {
    element: "[data-tour='command-center']",
    popover: {
      title: "Արագ որոնում",
      description: "⌘K (կամ այս կոճակը)՝ ցանկացած էջ կամ գործողություն մեկ վայրկյանում գտնելու համար։",
    },
  },
  {
    element: "[data-tour='install-app']",
    popover: {
      title: "Տեղադրիր որպես հավելված",
      description: "Մեկ սեղմումով ավելացրու հեռախոսիդ կամ համակարգչիդ էկրանին՝ որպես իսկական հավելված։",
    },
  },
];

export function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* private mode */
  }
}

/** Start the tour now (used by both the auto-trigger and the ⌘K action). */
export function startTour() {
  // Resolve each anchor to the first VISIBLE match — the same data-tour name
  // exists on both the desktop sidebar and the mobile tab bar, and whichever
  // is display:none has offsetParent === null. Steps with no visible anchor
  // are dropped.
  const steps: DriveStep[] = [];
  for (const s of STEPS) {
    if (!s.element) {
      steps.push(s);
      continue;
    }
    const el = Array.from(
      document.querySelectorAll<HTMLElement>(s.element as string),
    ).find((e) => e.offsetParent !== null);
    if (el) steps.push({ ...s, element: el });
  }
  if (!steps.length) return;
  const d = driver({
    steps,
    showProgress: true,
    nextBtnText: "Հաջորդ",
    prevBtnText: "Նախորդ",
    doneBtnText: "Պատրաստ է ✓",
    progressText: "{{current}} / {{total}}",
    onDestroyed: () => markTourSeen(),
  });
  d.drive();
}
