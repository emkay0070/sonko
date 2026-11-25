import { ChildStyle } from '../scene3d/characters';

export type DialogueEventTag =
  | 'INTRO'
  | 'AIM'
  | 'THROW'
  | 'GOOD_TOSS'
  | 'BULLSEYE'
  | 'LAUGH'
  | 'ANNOYED'
  | 'WOBBLE'
  | 'HOUSE_CLAIM'
  | 'CHEER'
  | 'WIN'
  | 'IDLE_BANTER';

export interface DialogueLineEntry {
  text: string;
  audioUrl?: string;
}

export type CharacterDialogueBank = Partial<Record<DialogueEventTag, DialogueLineEntry[]>>;

const toBank = (raw: Partial<Record<DialogueEventTag, string[]>>): CharacterDialogueBank => {
  const out: CharacterDialogueBank = {};
  for (const [k, lines] of Object.entries(raw)) {
    if (lines) {
      out[k as DialogueEventTag] = lines.map((text) => ({ text }));
    }
  }
  return out;
};

const FALLBACK_DIALOGUES: Record<ChildStyle, CharacterDialogueBank> = {
  kato: toBank({
    INTRO: ['Kato is ready! Watch how clean my stone lands today.'],
    AIM: ['Steady hand, flat stone, right into the middle.'],
    THROW: ['Fly straight, river stone!'],
    GOOD_TOSS: ['Eeeh! Clean inside the box!'],
    BULLSEYE: ['Dead center! Who taught me how to throw like that?'],
    LAUGH: ['Haha! Look at that wobble, you almost sat in the dust!'],
    ANNOYED: ['Aaaah! That chalk line jumped right under my foot!'],
    WOBBLE: ['Whoa, easy, easy... stay on one foot!'],
    HOUSE_CLAIM: ["Ekizimbe! That square is Kato's house now!"],
    CHEER: ['Webale! That was smooth!'],
    WIN: ['Champion of the courtyard! Who wants a rematch?'],
    IDLE_BANTER: ['The sun is warm, the chalk is bright, let us play Sonko!'],
  }),
  namukasa: toBank({
    INTRO: ['Namukasa never misses two turns in a row. Your move!'],
    AIM: ['Precision beats power every single time.'],
    THROW: ['Watch this release!'],
    GOOD_TOSS: ['Right where I wanted it. Watch and learn!'],
    BULLSEYE: ['Center of the square! Beat that if you can!'],
    LAUGH: ['Haha! Oh, you stepped right on the line! My turn!'],
    ANNOYED: ['Ugh, seriously? That stone skidded off a pebble!'],
    WOBBLE: ['Hold on... steady... I have got this!'],
    HOUSE_CLAIM: ['That house belongs to Namukasa now! Stay out!'],
    CHEER: ['Kale! Now that is how you clear a row!'],
    WIN: ['Victory is mine! Told you precision wins!'],
    IDLE_BANTER: ['Watch the split squares, land squarely on both feet!'],
  }),
  auma: toBank({
    INTRO: ['Yay! Auma is playing! Watch my fast hops!'],
    AIM: ['Aiming carefully... please stay inside, little stone!'],
    THROW: ['Wheee, go stone, go!'],
    GOOD_TOSS: ['Woohoo! It stayed inside!'],
    BULLSEYE: ['Right in the middle! Did everyone see that?!'],
    LAUGH: ['Hehehe! Oops, you wobbled right out of the box!'],
    ANNOYED: ['Aww, man! Why did my stone bounce out?!'],
    WOBBLE: ['Whoopsie! Steady, steady, one foot only!'],
    HOUSE_CLAIM: ['Yay! Auma built a shiny new house!'],
    CHEER: ['Go, go, go! You are flying!'],
    WIN: ['I won! I won! Wait, let us play another round!'],
    IDLE_BANTER: ['Hop on one foot, then land on both feet in the split!'],
  }),
  ssemakula: toBank({
    INTRO: ['Take it easy, Ssemakula has arrived. Let the stone glide.'],
    AIM: ['Patience wins Sonko. Just wait for the sweet spot.'],
    THROW: ['Glide easy now.'],
    GOOD_TOSS: ['Smooth as river water. Right in the square.'],
    BULLSEYE: ['Right on the dot. That is pure muscle memory.'],
    LAUGH: ['Haha! Easy there, friend, the ground is not moving!'],
    ANNOYED: ['Hmmph. I rushed that release. My own fault.'],
    WOBBLE: ['Easy, Ssemakula, bend the knee and absorb it.'],
    HOUSE_CLAIM: ['Home sweet home. That square belongs to me now.'],
    CHEER: ['Solid form! Look at that balance!'],
    WIN: ['Steady hands take the trophy. Well played, everyone!'],
    IDLE_BANTER: ['A deep knee bend on landing keeps your balance at a hundred.'],
  }),
};

function resolveVoiceClipUrl(rawClip: string): string | undefined {
  const cleaned = rawClip.trim();
  if (!cleaned) return undefined;
  if (cleaned.startsWith('/') || cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    return cleaned;
  }
  return `/audio/voices/${cleaned.replace(/^\.?\//, '')}`;
}

export function parseDialogueTxt(raw: string): CharacterDialogueBank {
  const bank: CharacterDialogueBank = {};
  let currentTag: DialogueEventTag | null = null;

  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const tagMatch = /^\[([A-Z0-9_]+)\]$/.exec(line);
    if (tagMatch) {
      currentTag = tagMatch[1] as DialogueEventTag;
      if (!bank[currentTag]) {
        bank[currentTag] = [];
      }
      continue;
    }

    if (currentTag) {
      // Optional format: "Line text | clip_name.mp3" or "Line text | /audio/voices/clip.ogg"
      const pipeIdx = line.lastIndexOf('|');
      if (pipeIdx > 0) {
        const text = line.slice(0, pipeIdx).trim();
        const clipPart = line.slice(pipeIdx + 1).trim();
        if (text) {
          bank[currentTag]!.push({
            text,
            audioUrl: /\.(mp3|ogg|wav|m4a|webm)$/i.test(clipPart)
              ? resolveVoiceClipUrl(clipPart)
              : undefined,
          });
        }
      } else {
        bank[currentTag]!.push({ text: line });
      }
    }
  }
  return bank;
}

class DialogueRepository {
  private banks: Record<ChildStyle, CharacterDialogueBank> = {
    kato: { ...FALLBACK_DIALOGUES.kato },
    namukasa: { ...FALLBACK_DIALOGUES.namukasa },
    auma: { ...FALLBACK_DIALOGUES.auma },
    ssemakula: { ...FALLBACK_DIALOGUES.ssemakula },
  };
  private lastUsed = new Map<string, number>();
  private loadStarted = false;

  public preloadAll(): void {
    if (this.loadStarted || typeof fetch === 'undefined') return;
    this.loadStarted = true;

    const characters: ChildStyle[] = ['kato', 'namukasa', 'auma', 'ssemakula'];
    for (const id of characters) {
      void fetch(`/dialogues/${id}.txt`, { cache: 'no-cache' })
        .then((res) => (res.ok ? res.text() : null))
        .then((txt) => {
          if (!txt) return;
          const parsed = parseDialogueTxt(txt);
          if (Object.keys(parsed).length > 0) {
            this.banks[id] = { ...FALLBACK_DIALOGUES[id], ...parsed };
          }
        })
        .catch(() => {
          // Offline or unavailable: keep embedded fallback lines
        });
    }
  }

  public pickEntry(character: ChildStyle, event: DialogueEventTag): DialogueLineEntry | null {
    this.preloadAll();
    const bank = this.banks[character] ?? FALLBACK_DIALOGUES[character];
    const pool = bank[event] && bank[event]!.length > 0 ? bank[event]! : bank.IDLE_BANTER ?? [];
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const key = `${character}:${event}`;
    const prevIdx = this.lastUsed.get(key) ?? -1;
    let idx = Math.floor(Math.random() * pool.length);
    if (idx === prevIdx) {
      idx = (idx + 1) % pool.length;
    }
    this.lastUsed.set(key, idx);
    return pool[idx];
  }

  public pickLine(character: ChildStyle, event: DialogueEventTag): string {
    return this.pickEntry(character, event)?.text ?? '';
  }
}

export const dialogueRepo = new DialogueRepository();
