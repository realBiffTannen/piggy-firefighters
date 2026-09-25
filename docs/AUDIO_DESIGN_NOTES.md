# Designing Audio for Casino Games: notes and takeaways

**Source:** "Designing Audio for Casino Games", panel at Casual Connect USA, July 2013.
Uploaded by GameDaily Connect on 2013-08-26. Length 27:04. https://www.youtube.com/watch?v=29fCl2jUHik

**Panel:**
- Jesse Holt, sound designer and composer at DoubleDown Interactive (moderator)
- Greg Rahn, lead audio designer and composer at Kabam
- Aaron Walz, freelance sound designer and composer
- Andreas Montano, producer at DoubleDown Interactive

**About the captions:** the video has no human-made captions, only YouTube's auto-generated
English track. It has no punctuation, and it garbles speaker names ("walls" for Walz). The notes
below are a timestamped paraphrase of that track, not a word-for-word transcript. To get the raw
captions yourself:

```sh
yt-dlp --skip-download --write-auto-subs --sub-langs en --sub-format vtt \
  "https://www.youtube.com/watch?v=29fCl2jUHik"
```

---

## Timestamped notes

| Time | Speaker | What was said |
|---|---|---|
| 00:10 | Host | Introduces Holt, who has made game audio since 1999 and co-founded the Game Audio Alliance. |
| 01:20 | Holt | Casual games tell a story. Casino games are a different experience, and he had to change how he worked when he joined DoubleDown. |
| 03:00 | Rahn | Kabam "slotified" its themed titles: it reused the existing art and music, edited to fit a slot. Version 1 did OK but was not a hit. |
| 04:05 | Rahn | In player testing, players kept bringing up the sound. The Vegas slot sound is what makes it fun. |
| 04:38 | Rahn | For version 2 they modelled hardware slots, studied the psychology of sound, and consulted people who design audio for hardware slots. |
| 04:38–05:43 | Rahn | Biggest lesson: **anticipation**. Each bonus symbol that lands adds a rising tone, like a chord progression held unresolved (a ii–V without the I). His stated purpose was to pull the player into spinning again. He tells a story about Bach and an unresolved chord. |
| 05:43 | Rahn | The original themes became unrecognisable, but the games now "popped" like real slots. |
| 06:54 | Walz | Slot work is mostly sound effects, with little music. He loves themed and licensed floor machines that loop music on every spin, but his clients didn't want that. |
| 07:27 | Walz | Clients usually ask for the generic arpeggio. He finds it boring and not sustainable artistically. |
| 08:01 | Walz | Casino floor machines are built to attract people across a loud room. Phones, tablets and PCs are a different environment, so realistic floor sound may be the wrong goal. |
| 08:33 | Walz | This parallels old arcade cabinets: loud, staccato and sharp, to pull people in. |
| 09:06 | Walz | One client asked for crowd ambience (betting, cheering). He did it, but doubts that realism is the goal. |
| 09:38 | Montano | Start from the target audience for each platform. The desktop audience skews older and female and wants the immersive casino fantasy, so ambience and background music help. |
| 10:10 | Montano | On mobile the speakers are different, many players are muted or on headphones, and the audience is younger. |
| 10:43 | Montano | Tone also depends on game type. Poker's audience is mostly male, so its sound is more aggressive, like a sports broadcast. Slot sound comes from 80s arcade and 8-bit. |
| 11:16 | Rahn | What casual games and slots share: the soundscape has to be pleasing. If it is abrasive, players hit mute. |
| 12:27 | Walz | The most important slot sound is the **anticipation stop** on a bonus or jackpot. It is the most exciting moment, and it is rare. |
| 13:36 | Walz | Some developers wanted the same click on every reel stop. He calls that a "major opportunity missed". |
| 13:36 | Holt | DoubleDown only recently started giving the third reel its own treatment. He is tired of chromatic bleeps. |
| 14:40 | Holt | Chopping music into phrases: a 45–60 s piece is cut into chunks, and each spin plays a randomised chunk. |
| 15:12 | Walz | On the pirate slot *Slots of Plunder* he added voiceover lines for small, medium and large wins. He thinks casino games under-use voiceover. |
| 16:18 | Rahn / Holt | Voiceover splits players: some love it, others want it gone. |
| 16:51 | Walz | The player stays on the same screen for a very long time, so the audio has to be dynamic. He uses a long ambient loop that moves into other loops, and a separate music track for the bonus. |
| 18:00 | Rahn | Audio drove the design. The audio team asked production and the programmers for specific timing hooks so the game would behave like a hardware slot, and they got most of them. |
| 18:32 | Rahn | They tested 3 titles, saw a significant lift, and then decided to roll the change out to about 20 titles. |
| 19:38 | Q&A | How was the lift measured? The analytics team handles that. The audio team was not given a specific target metric. |
| 20:44 | Walz | Desktop and Facebook games aim for immersion. Mobile speakers are too small to be immersive, and most mobile players don't use headphones. |
| 21:17 | Walz | Porting a game across platforms means balancing annoyance against experience. Expect revisions, and sometimes a full redo when a publisher says it is too annoying. |
| 22:25 | Q&A | Real slot sounds are "tacky" compared with polished console audio. Where do you draw the line on production values? |
| 23:30 | Walz | He has over-produced before and been told to start over, because people expected something tackier. It varies by developer. |
| 24:03 | Walz | Modern floor machines are now very high quality, with surround sound and orchestral scores. |
| 24:35 | Rahn | The "cheese factor" is part of a slot's personality. Kabam's serious core-gamer scores did not read as a slot until they were reworked. |
| 25:07 | Montano | DoubleDown's first poker game sounded like video poker and lacked depth, so they are moving it toward a sports-broadcast feel. |
| 25:41 | Montano | Match the audio's quality to the art and animation: either high-end, or retro-Vegas cheese. |
| 26:15 | Holt | His casual-game rule was that audio supports the game and stays out of the way. Casino players expected more energy, so he had to "juice it up". |

---

## Takeaways for designing slot audio

1. **Anticipation is the most important sound.** Escalate on each qualifying symbol that lands, for
   example by stepping pitch or harmony up on scatters 1, 2 and 3. Hold the tension until the outcome
   is known, then resolve it on the trigger. *(04:38, 12:27)*
2. **Never give every reel stop the same sound.** Make reel stops different, and give the stops that
   can still complete a feature their own treatment. Uniform clicks waste the best moment in the game. *(13:36)*
3. **Pleasant beats loud.** Players sit on one screen for hours. Any abrasive, harsh or repetitive
   sound gets muted, and a muted game has no audio design at all. *(11:16)*
4. **Build variation into long sessions.** Use long ambient beds that cross-fade into variants. Cut
   the music into phrases so each spin plays a different chunk. Give the bonus its own music track
   so a state change is heard, not just seen. *(14:40, 16:51)*
5. **Don't copy the casino floor.** Floor machines are mixed to attract people across a loud room.
   On a phone or PC the same approach reads as noise. Crowd ambience is optional, not required. *(08:01, 09:06)*
6. **Design for the platform.**
   - On mobile: small speakers, often muted, younger players. Mix for phone speakers, where
     midrange carries and bass is lost. Every sound cue must also have a visual cue.
   - On desktop: players want immersion, so fuller ambience and music fit. *(09:38, 20:44)*
7. **The audience and game type set the tone.** Slots come from arcade and 8-bit roots, and poker
   leans toward a sports broadcast. Choose the palette for who is playing. *(10:43)*
8. **The "cheese factor" is a feature.** Slot audio has a playful personality. Don't drop in a
   serious or cinematic score as-is: rework it into slot idioms (rolls, rising stingers, bright
   stops). *(04:05, 24:35)*
9. **Match audio quality to art quality.** Pair polished art with polished audio (the new floor
   machines are orchestral and surround), and retro art with retro cheese. Over-producing can get
   the work rejected. *(23:30, 25:41)*
10. **Give each win tier its own sound.** Small, medium, large and big wins each get a cue. Voiceover
    per tier adds character but splits players, so keep it sparse or give it its own toggle. *(15:12, 16:18)*
11. **Audio drives design, so ask for hooks early.** Put the timing windows audio needs into the
    game-state spec from the start: per-reel stops, the anticipation slow-down, bonus entry and exit,
    and the start and end of the win count-up. Don't bolt them on later. *(18:00)*
12. **Measure it.** Kabam A/B tested 3 titles before rolling the change out to 20. Treat an audio
    overhaul as a test you can measure. *(18:32)*
13. **Casino games need more energy than casual games,** but point 3 still limits it: exciting,
    never grating. *(26:15)*

---

## Notes for building this today (my additions, not from the panel)

- **This panel is from 2013,** the Flash and Facebook social-casino era, and regulation has moved on
  since. For example, the UK Gambling Commission's 2021 online slot design rules ban celebratory
  audio and visuals when a return is less than or equal to the stake. Key win-tier sounds to the
  win-to-bet ratio, and play a neutral cue or nothing when a return is at or below the bet.
- **Rahn's reason for the unresolved progression** was to pull players into another spin. That is a
  persuasion technique. Use anticipation to make real feature chances exciting: play it only while
  the trigger is still possible, and never use it to dress up losses. Check the rules for your
  target jurisdiction.
- **Turbo and super-turbo modes:** merge the per-reel stops into a single stop sound, and keep an
  anticipation cue only if the reels still slow down. Audio must not stretch the spin cadence.
- **Stake web-sdk approval** requires a sound mute control. The browser also needs a user gesture
  before audio can play, which the splash "press anywhere" gate provides.
- **Loudness:** normalise the assets to a shared integrated-loudness target (about −14 LUFS), and
  duck the ambience and music under win cues.

### Starter audio map

| Game event | Cue | Notes |
|---|---|---|
| Idle / base game | Long ambient or music bed, 2–3 variants | Cross-fade between variants. Keep it quiet. |
| Spin start | Short whoosh or button cue | Plays on every spin, so it must stay easy on the ear. |
| Reel stop, normal | Soft stop, with slight variation per reel | Rotate between 2–3 alternate takes to avoid machine-gun repetition. |
| Scatter lands (n-th) | Stinger that rises in step with n | Unresolved until the trigger is decided. |
| Anticipation reel | Tension riser, synced to the reel slow-down | Only while the trigger is still possible. |
| Win (tiered by win/bet) | Separate cues for small, medium, large and big win | No celebration when the return is ≤ the bet. Optional voiceover. |
| Win count-up | Roll loop and end hit | Duck the music underneath. |
| Feature trigger | Resolving stinger | Pays off the anticipation. |
| Bonus round | Separate music track | Clear musical change on entry and on exit. |
| Bonus exit / total | Summary fanfare scaled to the total | Then return to the base bed. |
