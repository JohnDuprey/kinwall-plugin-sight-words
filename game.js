// Sight words: Kinwall says a word, the child taps it. Ten stars move up a level. Progress is saved
// for whoever is playing (Kinwall asks "Who's playing?" before opening a plugin).
const LEVELS = [
  ['a', 'I', 'the', 'and', 'see', 'to', 'can', 'go', 'we', 'me', 'my', 'is', 'it', 'in', 'up'],
  ['you', 'look', 'said', 'come', 'here', 'play', 'big', 'red', 'blue', 'jump', 'run', 'one', 'two', 'down', 'not'],
  ['have', 'like', 'with', 'what', 'they', 'this', 'that', 'good', 'she', 'he', 'was', 'are', 'saw', 'now', 'all'],
  ['after', 'again', 'could', 'every', 'from', 'going', 'know', 'once', 'open', 'over', 'some', 'take', 'thank', 'them', 'when'],
]
const STARS_PER_LEVEL = 10
const PRAISE = ['Yes!', 'Great job!', 'You got it!', 'Nice reading!', 'Awesome!', "That's right!", 'Super!', 'Well done!', 'Way to go!']
const LEVEL_UP = ['Level up! Great reading!', 'Level up! You are a super reader!', 'New level! Keep it up!']
const RECENT = 4 // a word isn't asked again until this many others have been

const el = id => document.getElementById(id)
const speech = 'speechSynthesis' in window ? window.speechSynthesis : null
let progress = { level: 0, stars: 0, total: 0 }
let target = ''
let locked = false
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

let speaking = null // the current utterance, referenced so it isn't garbage-collected mid-sentence
let turn = 0

/** Speaks; resolves once it's finished (or after a fallback). `word`: one sight word, said slowly and clearly. */
async function say(text, { word = false } = {}) {
  if (!speech) return
  const mine = ++turn
  if (speech.speaking || speech.pending) {
    speech.cancel()
    await sleep(150) // speaking straight after cancel() clips or garbles the start
    if (mine !== turn) return // something newer asked to speak meanwhile
  }
  speech.resume() // Chrome sometimes leaves the queue paused
  await new Promise(resolve => {
    const spoken = word ? `${SAY_AS[text.toLowerCase()] ?? text}.` : text // the period gives a word a clean ending
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
  el('level').textContent = `Level ${progress.level + 1} of ${LEVELS.length}`
}

function next() {
  locked = false
  const words = LEVELS[progress.level]
  // The word to find is one not asked recently; the other two are any different words.
  const fresh = words.filter(w => !recent.includes(w))
  target = shuffle(fresh.length ? fresh : words)[0]
  recent.push(target)
  if (recent.length > RECENT) recent.shift()
  const pick = shuffle([target, ...shuffle(words.filter(w => w !== target)).slice(0, 2)])
  // No voice on this device: show the word and ask for its match instead.
  el('ask').innerHTML = speech ? 'Tap the word you hear' : `Find: <span class="target">${target}</span>`
  el('say').hidden = !speech
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
    button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong')
    say(target, { word: true })
    return
  }
  locked = true
  button.classList.add('right')
  progress.stars++
  progress.total++
  const levelUp = progress.stars >= STARS_PER_LEVEL
  const finished = levelUp && progress.level === LEVELS.length - 1 // no level left: celebrate and keep practicing
  if (levelUp) {
    progress.stars = 0
    if (!finished) { progress.level++; recent.length = 0 } // new words
  }
  render()
  Kinwall.save('progress', progress).catch(() => { /* offline: keep playing, it saves next time */ })
  // Let the praise finish, then a beat, so it never runs into the next word.
  await Promise.all([say(finished ? 'You read every word! Amazing!' : pickFrom(levelUp ? LEVEL_UP : PRAISE)), sleep(PAUSE.least)])
  await sleep(levelUp ? PAUSE.afterLevelUp : PAUSE.afterPraise)
  next()
}

el('say').onclick = () => say(target, { word: true })

Kinwall.ready().then(async ctx => {
  el('who').textContent = ctx.member ? `${ctx.member.avatar || ''} ${ctx.member.name}` : ''
  if (ctx.reducedMotion) document.documentElement.dataset.reducedMotion = ''
  const saved = await Kinwall.load().catch(() => ({}))
  if (saved.progress) progress = { ...progress, ...saved.progress }
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
