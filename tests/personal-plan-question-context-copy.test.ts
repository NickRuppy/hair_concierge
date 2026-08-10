import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  DAILY_TIME_OPTIONS,
  QUESTION_CONFIGS,
  getConcernOptions,
} from "../src/components/personal-plan-quiz/quiz-data"

function read(path: string) {
  return readFileSync(path, "utf8")
}

test("Personal Plan question helpers use the approved bounded context copy", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")
  const currentProblems = quiz.slice(
    quiz.indexOf('if (screen === "current_problems")'),
    quiz.indexOf('if (screen === "analysis_bridge")'),
  )
  const recurrence = quiz.slice(
    quiz.indexOf("function AdmissionScreen"),
    quiz.indexOf("function ReframeScreen"),
  )
  const dailyTime = quiz.slice(
    quiz.indexOf("function DailyTimeScreen"),
    quiz.indexOf("const LOADING_RUN_MS"),
  )

  assert.equal(
    QUESTION_CONFIGS.thickness?.helper,
    "Wenn du unsicher bist: Rolle ein einzelnes trockenes Haar zwischen Daumen und Zeigefinger.",
  )
  assert.match(currentProblems, /helper: "Wähle alles aus, was du aktuell bemerkst\."/)
  assert.match(
    recurrence,
    /eyebrow=\{screen === "admission_recurrence" \? "Zurück zu deinen Haarthemen" : undefined\}/,
  )
  assert.match(recurrence, /`Wie oft bemerkst du \$\{primaryConcernLabel\}\?`/)
  assert.match(recurrence, /Denk daran, wie es in letzter Zeit meistens war\./)
  assert.equal(
    getConcernOptions("wavy").find((option) => option.value === "low_volume_or_weighed_down")
      ?.midSentenceLabel,
    "einen flachen Ansatz oder beschwerte Längen",
  )
  assert.equal(
    QUESTION_CONFIGS.previous_attempts?.title,
    "Wie gut haben deine bisherigen Versuche funktioniert?",
  )
  assert.equal(
    QUESTION_CONFIGS.previous_attempts?.helper,
    "Denk an Produkte, einzelne Schritte und deine bisherige Routine.",
  )
  assert.match(
    dailyTime,
    /title="Wie viel aktive Zeit möchtest du an einem typischen Pflegetag einplanen\?"/,
  )
  assert.match(dailyTime, /Trocknen und Warten zählen nicht mit\./)
})

test("question context changes preserve answer identities, card mechanics, and sibling questions", () => {
  const quiz = read("src/components/personal-plan-quiz/personal-plan-quiz.tsx")
  const currentProblems = quiz.slice(
    quiz.indexOf('if (screen === "current_problems")'),
    quiz.indexOf('if (screen === "analysis_bridge")'),
  )
  const recurrence = quiz.slice(
    quiz.indexOf("function AdmissionScreen"),
    quiz.indexOf("function ReframeScreen"),
  )

  assert.deepEqual(
    QUESTION_CONFIGS.thickness?.options.map(({ value, label, description, image }) => ({
      value,
      label,
      description,
      hasImage: Boolean(image),
    })),
    [
      {
        value: "fine",
        label: "Fein",
        description: "Kaum spürbar, dünner als ein Nähfaden.",
        hasImage: true,
      },
      {
        value: "normal",
        label: "Mittel",
        description: "Spürbar, etwa wie ein Nähfaden.",
        hasImage: true,
      },
      {
        value: "coarse",
        label: "Dick",
        description: "Deutlich spürbar, eher kräftig.",
        hasImage: true,
      },
    ],
  )
  assert.deepEqual(
    QUESTION_CONFIGS.previous_attempts?.options.map(({ value, label }) => ({ value, label })),
    [
      {
        value: "nothing_reliably_worked",
        label: "Ich habe vieles probiert, aber nichts hat zuverlässig funktioniert",
      },
      {
        value: "little_targeted_trial",
        label: "Ich habe bisher nur wenig gezielt ausprobiert",
      },
      {
        value: "some_steps_helped",
        label: "Einzelne Produkte oder Schritte haben geholfen",
      },
      {
        value: "mostly_works",
        label: "Meine bisherige Routine funktioniert größtenteils",
      },
    ],
  )
  assert.deepEqual(
    DAILY_TIME_OPTIONS.map(({ value, label }) => ({ value, label })),
    [
      { value: "5_minutes", label: "5 Minuten" },
      { value: "10_minutes", label: "10 Minuten" },
      { value: "15_minutes", label: "15 Minuten" },
      { value: "20_plus_minutes", label: "20+ Minuten" },
    ],
  )
  assert.equal(QUESTION_CONFIGS.routine_clarity?.title, "Wie klar ist deine aktuelle Haarpflege?")
  assert.equal(QUESTION_CONFIGS.result_reliability?.title, "Wie oft gelingt dein Wunschergebnis?")
  assert.match(currentProblems, /field: "currentConcerns"/)
  assert.match(currentProblems, /options: getConcernOptions\(answers\.texture\)/)
  assert.match(currentProblems, /multi: true/)
  assert.match(currentProblems, /visual: true/)
  assert.match(recurrence, /content\.options\.map\(\(option\) =>/)
  assert.match(recurrence, /<OptionCard/)
  assert.match(recurrence, /onClick=\{\(\) => onSelect\(option\.value\)\}/)
})

test("legacy-tested scalp questions remain verbatim and multi-select", () => {
  assert.deepEqual(QUESTION_CONFIGS.scalp_oiliness, {
    field: "scalpOiliness",
    title: "Wie würdest du deine Kopfhaut beschreiben?",
    eyebrow: "Kopfhaut",
    helper:
      "Deine Gesichtshaut gibt dir einen guten Hinweis — eine ölige T-Zone deutet auf fettige Kopfhaut hin.",
    options: [
      {
        value: "oily",
        label: "Fettig",
        description: "Ansätze werden nach 1–2 Tagen ölig.",
        icon: "droplet",
      },
      {
        value: "balanced",
        label: "Ausgeglichen",
        description: "Kommt gut 2–3 Tage ohne Waschen klar.",
        icon: "scale",
      },
      {
        value: "dry",
        label: "Trocken",
        description: "Spannt gelegentlich, fühlt sich eher rau an.",
        icon: "sun-dim",
      },
    ],
  })
  assert.deepEqual(QUESTION_CONFIGS.scalp_concerns, {
    field: "scalpConcerns",
    title: "Was trifft aktuell auf deine Kopfhaut zu?",
    eyebrow: "Kopfhaut",
    helper:
      "Wähle alles aus, was du bemerkst. Das hilft, den Plan kosmetisch verantwortungsvoll einzuordnen.",
    multi: true,
    options: [
      {
        value: "oily_dandruff",
        label: "Fettige Schuppen",
        description: "Größere, gelbliche, ölige Flocken, die an Kopfhaut und Ansatz haften.",
      },
      {
        value: "dry_dandruff",
        label: "Trockene Schuppen",
        description: "Kleine, weiße, trockene Flocken, die rieseln — Kopfhaut spannt oft.",
      },
      {
        value: "irritated",
        label: "Gereizte oder empfindliche Kopfhaut",
        description: "Jucken, Rötungen oder Brennen.",
      },
    ],
  })
})

test("authenticated onboarding uses answer guidance without changing selection wiring", () => {
  const onboarding = read("src/components/onboarding/onboarding-flow.tsx")
  const towelMaterial = onboarding.slice(
    onboarding.lastIndexOf('case "towel_material"'),
    onboarding.lastIndexOf('case "towel_technique"'),
  )
  const towelTechnique = onboarding.slice(
    onboarding.lastIndexOf('case "towel_technique"'),
    onboarding.lastIndexOf('case "drying_method"'),
  )
  const dryingMethod = onboarding.slice(
    onboarding.lastIndexOf('case "drying_method"'),
    onboarding.lastIndexOf('case "brush_type"'),
  )

  assert.match(towelMaterial, /subtitle="Wähle, was dein nasses Haar meistens berührt\."/)
  assert.doesNotMatch(towelTechnique, /subtitle=/)
  assert.match(dryingMethod, /subtitle="Wähle, was du nach dem Waschen meistens machst\."/)

  for (const source of [towelMaterial, towelTechnique, dryingMethod]) {
    assert.match(source, /<SingleSelectScreen/)
    assert.match(source, /options=/)
    assert.match(source, /selected=/)
    assert.match(source, /onSelect=/)
    assert.match(source, /onBack=\{handleBack\}/)
  }
})
