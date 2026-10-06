// Sight words: Kinwall says a word, the child taps it. Ten stars move up a level. Progress is saved
// for whoever is playing (Kinwall asks "Who's playing?" before opening a plugin).
// The Dolch sight words (220, the list most US schools send home), in its grade order, cut into
// levels of about 14 so each level's words come round often enough to learn.
const DOLCH = [
  ['a', 'and', 'away', 'big', 'blue', 'can', 'come', 'down', 'find', 'for', 'funny', 'go', 'help', 'here', 'I', 'in', 'is', 'it', 'jump', 'little', 'look', 'make', 'me', 'my', 'not', 'one', 'play', 'red', 'run', 'said', 'see', 'the', 'three', 'to', 'two', 'up', 'we', 'where', 'yellow', 'you'],
  ['all', 'am', 'are', 'at', 'ate', 'be', 'black', 'brown', 'but', 'came', 'did', 'do', 'eat', 'four', 'get', 'good', 'have', 'he', 'into', 'like', 'must', 'new', 'no', 'now', 'on', 'our', 'out', 'please', 'pretty', 'ran', 'ride', 'saw', 'say', 'she', 'so', 'soon', 'that', 'there', 'they', 'this', 'too', 'under', 'want', 'was', 'well', 'went', 'what', 'white', 'who', 'will', 'with', 'yes'],
  ['after', 'again', 'an', 'any', 'as', 'ask', 'by', 'could', 'every', 'fly', 'from', 'give', 'going', 'had', 'has', 'her', 'him', 'his', 'how', 'just', 'know', 'let', 'live', 'may', 'of', 'old', 'once', 'open', 'over', 'put', 'round', 'some', 'stop', 'take', 'thank', 'them', 'then', 'think', 'walk', 'were', 'when'],
  ['always', 'around', 'because', 'been', 'before', 'best', 'both', 'buy', 'call', 'cold', 'does', "don't", 'fast', 'first', 'five', 'found', 'gave', 'goes', 'green', 'its', 'made', 'many', 'off', 'or', 'pull', 'read', 'right', 'sing', 'sit', 'sleep', 'tell', 'their', 'these', 'those', 'upon', 'us', 'use', 'very', 'wash', 'which', 'why', 'wish', 'work', 'would', 'write', 'your'],
  ['about', 'better', 'bring', 'carry', 'clean', 'cut', 'done', 'draw', 'drink', 'eight', 'fall', 'far', 'full', 'got', 'grow', 'hold', 'hot', 'hurt', 'if', 'keep', 'kind', 'laugh', 'light', 'long', 'much', 'myself', 'never', 'only', 'own', 'pick', 'seven', 'shall', 'show', 'six', 'small', 'start', 'ten', 'today', 'together', 'try', 'warm'],
]
/** Splits a grade's words into even levels of at most `size`. */
function chunk(words, size = 14) {
  const n = Math.ceil(words.length / size), out = []
  for (let i = 0; i < n; i++) out.push(words.slice(Math.round(i * words.length / n), Math.round((i + 1) * words.length / n)))
  return out
}
const LEVELS = DOLCH.flatMap(grade => chunk(grade))
const ALL_WORDS = LEVELS.flat()
// Progress saved before v1.4 (four levels of 15) moves to the new level with the same words.
const OLD_LEVEL = [0, 2, 4, 7]
const STARS_PER_LEVEL = 10
const PRAISE = ['Yes!', 'Great job!', 'You got it!', 'Nice reading!', 'Awesome!', "That's right!", 'Super!', 'Well done!', 'Way to go!']
const LEVEL_UP = ['Level up! Great reading!', 'Level up! You are a super reader!', 'New level! Keep it up!']
const RECENT = 6 // a word isn't asked again until this many others have been

const el = id => document.getElementById(id)
const speech = 'speechSynthesis' in window ? window.speechSynthesis : null
// level === LEVELS.length: every level done, reviewing all the words. missed: word -> misses not yet made up.
let progress = { v: 2, level: 0, stars: 0, total: 0, missed: {} }
let target = ''
let locked = false
let missedThis = false
const recent = []
let lastPraise = ''

const sleep = ms => new Promise(r => setTimeout(r, ms))

// Speech. The browser's voices vary a lot, so pick the clearest English one on the device, and work
// around the ways Web Speech glitches: speaking right after cancel() garbles the start, Chrome can
// drop onend for an utterance it garbage-collects, and some voices never fire onend at all.
// Unhurried for new readers: a single word noticeably slower than talking speed.
const RATE = { word: 0.65, praise: 0.85 }
const PAUSE = { afterPraise: 800, afterLevelUp: 1400, least: 1200 } // ms before the next word
const SAY_AS = { a: 'uh' } // the sight word "a", not the letter name
// macOS novelty and "Eloquence" voices: fun, but not clear enough for learning to read.
const UNCLEAR = /Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Deranged|Good News|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Grandma|Grandpa|Rocko|Shelley|Flo\b|Eddy|Reed|Sandy/i
const CLEAR = /Samantha|Ava|Allison|Susan|Zoe|Alex|Karen|Daniel|Serena|Moira|Tessa|Aria|Jenny|Guy|Libby|Natural/i
let voice = null
function pickVoice() {
  const english = speech.getVoices().filter(v => /^en([-_]|$)/i.test(v.lang) && !UNCLEAR.test(v.name))
  const score = v => (v.localService ? 4 : 0) + (/en[-_]US/i.test(v.lang) ? 2 : 0) + (CLEAR.test(v.name) ? 3 : 0) + (v.default ? 1 : 0)
  voice = english.sort((a, b) => score(b) - score(a))[0] ?? null
}
if (speech) { pickVoice(); speech.addEventListener?.('voiceschanged', pickVoice) }

// No Web Speech here (Android's WebView): Kinwall speaks instead, when it can (Kinwall.speak).
let kinwallSpeaks = false
const canSay = () => !!speech || kinwallSpeaks

let speaking = null // the current utterance, referenced so it isn't garbage-collected mid-sentence
let turn = 0

/** Speaks; resolves once it's finished (or after a fallback). `word`: one sight word, said slowly and clearly. */
async function say(text, { word = false } = {}) {
  const spoken = word ? `${SAY_AS[text.toLowerCase()] ?? text}.` : text // the period gives a word a clean ending
  if (!speech) { if (kinwallSpeaks) await Kinwall.speak(spoken, { rate: word ? RATE.word : RATE.praise }); return }
  const mine = ++turn
  if (speech.speaking || speech.pending) {
    speech.cancel()
    await sleep(150) // speaking straight after cancel() clips or garbles the start
    if (mine !== turn) return // something newer asked to speak meanwhile
  }
  speech.resume() // Chrome sometimes leaves the queue paused
  await new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(spoken)
    if (voice) { u.voice = voice; u.lang = voice.lang } else u.lang = 'en-US'
    u.rate = word ? RATE.word : RATE.praise
    u.pitch = 1
    const done = () => { clearTimeout(fallback); if (speaking === u) speaking = null; resolve() }
    const fallback = setTimeout(done, 1500 + spoken.length * 140) // slower speech takes longer
    u.onend = done
    u.onerror = done
    speaking = u
    speech.speak(u)
  })
}

/** A different phrase from the one said last time. */
function pickFrom(list) {
  const options = list.filter(p => p !== lastPraise)
  lastPraise = options[Math.floor(Math.random() * options.length)]
  return lastPraise
}

function shuffle(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

function render() {
  el('stars').textContent = '⭐'.repeat(progress.stars) + '☆'.repeat(STARS_PER_LEVEL - progress.stars)
  el('level').textContent = reviewing() ? `Review: all ${ALL_WORDS.length} words` : `Level ${progress.level + 1} of ${LEVELS.length}`
}

const reviewing = () => progress.level >= LEVELS.length

/** The word to ask: not asked recently, and half the time one this child has missed, if any. */
function pickTarget(words) {
  const fresh = words.filter(w => !recent.includes(w))
  const pool = fresh.length ? fresh : words
  const missed = pool.filter(w => progress.missed[w] > 0)
  return shuffle(missed.length && Math.random() < 0.5 ? missed : pool)[0]
}

function next() {
  locked = false
  missedThis = false
  // Reviewing: the other choices come from the target's own level, so they're as easy to mix up.
  target = pickTarget(reviewing() ? ALL_WORDS : LEVELS[progress.level])
  const words = reviewing() ? LEVELS.find(l => l.includes(target)) : LEVELS[progress.level]
  recent.push(target)
  if (recent.length > (reviewing() ? RECENT * 2 : RECENT)) recent.shift()
  const pick = shuffle([target, ...shuffle(words.filter(w => w !== target)).slice(0, 2)])
  // No voice on this device: show the word and ask for its match instead.
  el('ask').innerHTML = canSay() ? 'Tap the word you hear' : `Find: <span class="target">${target}</span>`
  el('say').hidden = !canSay()
  const box = el('choices')
  box.textContent = ''
  for (const w of pick) {
    const b = document.createElement('button')
    b.className = 'choice'
    b.textContent = w
    b.onclick = () => choose(b, w)
    box.append(b)
  }
  render()
  say(target, { word: true })
}

async function choose(button, word) {
  if (locked) return
  if (word !== target) {
    if (!missedThis) { missedThis = true; progress.missed[target] = (progress.missed[target] || 0) + 1 } // once per word asked
    button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong')
    say(target, { word: true })
    return
  }
  locked = true
  button.classList.add('right')
  progress.stars++
  progress.total++
  if (progress.missed[target] > 0 && --progress.missed[target] === 0) delete progress.missed[target]
  const levelUp = progress.stars >= STARS_PER_LEVEL
  const finished = levelUp && progress.level === LEVELS.length - 1 // last level done: celebrate, then review everything
  if (levelUp) {
    progress.stars = 0
    if (!reviewing()) { progress.level++; recent.length = 0 } // new words
  }
  render()
  Kinwall.save('progress', progress).catch(() => { /* offline: keep playing, it saves next time */ })
  // Let the praise finish, then a beat, so it never runs into the next word.
  await Promise.all([say(finished ? 'You read every word! Amazing!' : pickFrom(levelUp && !reviewing() ? LEVEL_UP : PRAISE)), sleep(PAUSE.least)])
  await sleep(levelUp ? PAUSE.afterLevelUp : PAUSE.afterPraise)
  next()
}

el('say').onclick = () => say(target, { word: true })

Kinwall.ready().then(async ctx => {
  el('who').textContent = ctx.member ? `${ctx.member.avatar || ''} ${ctx.member.name}` : ''
  kinwallSpeaks = !speech && !!ctx.canSpeak
  if (ctx.reducedMotion) document.documentElement.dataset.reducedMotion = ''
  const saved = await Kinwall.load().catch(() => ({}))
  if (saved.progress) {
    const old = saved.progress
    progress = { ...progress, ...old, v: 2, missed: old.missed ?? {} }
    if (!old.v) progress.level = OLD_LEVEL[old.level] ?? 0 // saved by v1.3 or earlier
    progress.level = Math.min(progress.level, LEVELS.length)
  }
  render()
  // Browsers only let a page speak after a tap inside it, so the game starts with one.
  const start = el('start')
  start.hidden = false
  start.focus()
  start.onclick = () => {
    start.hidden = true
    el('game').hidden = false
    if (speech) pickVoice() // voices can arrive late; pick again now they're surely loaded
    next()
  }
})
