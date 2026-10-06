// Help's ready-made conversations (R-075, Nate 9/29: "integrate this into a help page with prelisted conversations").
// WORDS ONLY: staff and Claude edit this file without touching the page's code (pub/talk.js draws it, pub/talk.css
// styles it). Every answer here teaches a real person how to act at the Hawaiʻi Legislature, so accuracy is the rule:
// write only what the tracker's own code and runbooks say (stops.js, pub/lessons.js, pub/helper.js, pub/more.js,
// backend JANUARY.md and SESSION_START.md) or what is general and certain. Not sure a fact is right? Leave it out.
//
// How to write one:
//   slug     the address, #/help/<slug>. Never rename one that has shipped: other pages and shared links point at it.
//   group    one of GROUPS' keys (the heading it sits under)
//   title    how it reads in the list, usually the first question
//   turns    2 to 5 exchanges, in order. q is the person's question (the first is also the page heading); a is HIPHI's
//            answer, one string or a list of short paragraphs, 1 to 3 sentences in all. art (optional) is a drawing
//            from ART in pub/talk.js, shown after the first paragraph; 'path:crossover' marks a spot on the bill's path.
//   related  2 or 3 other slugs offered when the conversation ends ("You might also ask")
//   act      optional: the one thing to do next, shown as the button at the end { label, href, icon }
// In the words: **bold**, [a link](#/legislators) (tel:, mailto: and https: work too), {nextOpen} = the day the next
// session opens ("Wednesday, January 20, 2027"; in session, "the third Wednesday in January"). Plain words, grade 8
// (DESIGN C-10); jargon only after the plain words; Hawaiʻi with the ʻokina; no emoji (A-11). Testimony is "due",
// and never only "24 hours" before: at least 24 hours, 48 for some Senate committees, and the tracker shows each
// hearing's own deadline.

const PAR = '[(808) 587-0478](tel:+18085870478)';   // the Legislature's Public Access Room: free help with testifying
const EMAIL = '[contact@hiphi.org](mailto:contact@hiphi.org)';

export const GROUPS = [
  { key: 'legislature', title: 'How the Legislature works', icon: 'landmark' },
  { key: 'hearings', title: 'Hearings', icon: 'gavel' },
  { key: 'testimony', title: 'Sending testimony', icon: 'notebook-pen' },
  { key: 'lawmakers', title: 'Talking to lawmakers', icon: 'message-square' },
  { key: 'words', title: 'Words you’ll see', icon: 'book-open' },
  { key: 'tracker', title: 'Using this tracker', icon: 'star' },
  { key: 'hiphi', title: 'About HIPHI and your data', icon: 'lock' },
];

export const TALKS = [
  // ---------------- How the Legislature works ----------------
  { slug: 'how-a-bill-becomes-law', group: 'legislature', title: 'How does a bill become law?',
    turns: [
      { q: 'How does a bill become law?', a: ['A **bill** is a proposed law. It starts in the House or the Senate, and it has to pass both before it goes to the Governor.'], art: 'path' },
      { q: 'What happens on each side?', a: 'First, committees study it and hold hearings. If they pass it, everyone on that side votes. Then it crosses to the other side and does it all again.' },
      { q: 'What if the two sides change it?', a: 'Both sides have to pass the very same wording. If they don’t agree, a few members from each side meet in a **conference committee** to settle on one version.' },
      { q: 'And then?', a: 'The Governor signs it, lets it become law without signing, or vetoes it. About 1 in 10 bills makes it all the way.' },
    ],
    related: ['why-bills-stop', 'what-is-a-committee', 'governor'] },

  { slug: 'what-is-the-legislature', group: 'legislature', title: 'What is the Legislature?',
    turns: [
      { q: 'What is the Legislature?', a: ['The lawmakers who write Hawaiʻi’s state laws. It has two sides: the **House**, with 51 representatives, and the **Senate**, with 25 senators.'], art: 'chambers' },
      { q: 'Who chooses them?', a: 'Voters do. Each one speaks for a district, a part of the state. Representatives are elected every 2 years, senators every 4.' },
      { q: 'Where do they meet?', a: 'At the State Capitol in Honolulu. You can watch many hearings online and speak on Zoom, so you can take part from any island.' },
      { q: 'Which ones are mine?', a: 'Everyone in Hawaiʻi has one senator and one representative. Type your home address and we’ll show you yours.' },
    ],
    related: ['my-legislators', 'when-is-the-session', 'how-a-bill-becomes-law'],
    act: { label: 'Find my legislators', href: '#/legislators', icon: 'users' } },

  { slug: 'when-is-the-session', group: 'legislature', title: 'When does the Legislature meet?',
    turns: [
      { q: 'When does the Legislature meet?', a: ['Once a year, in a stretch called the **session**. It opens on the third Wednesday in January and ends in early May.'], art: 'session' },
      { q: 'When is the next one?', a: 'The next session opens on **{nextOpen}**. Lawmakers bring in new bills in the first week or so.' },
      { q: 'Why does the timing matter?', a: 'The session is short: 60 working days. Every step has a deadline, and a bill that misses one stops for the year. So when a hearing comes up, act that week.' },
    ],
    related: ['session-deadlines', 'between-sessions', 'how-a-bill-becomes-law'] },

  { slug: 'why-bills-stop', group: 'legislature', title: 'Why do most bills stop?',
    turns: [
      { q: 'Why do most bills stop?', a: ['There are thousands of bills and only a few months. More than 2,000 new bills start each year, and about 1 in 10 becomes law.'], art: 'funnel' },
      { q: 'Where do they stop?', a: 'Mostly in committees. A committee’s chair picks which bills get a hearing, and many never get one. Others are put on hold at their hearing.' },
      { q: 'Is a stopped bill gone for good?', a: 'Not always. Lawmakers work in two-year terms, so a bill from the first year can come back in the second. Good ideas also return as new bills.' },
      { q: 'So is it worth speaking up?', a: 'Yes. With so many bills, committees look for signs that people care. A short note from someone who lives here can help a bill get heard.' },
    ],
    related: ['no-hearing-yet', 'deferred', 'does-testimony-matter'] },

  { slug: 'what-is-a-committee', group: 'legislature', title: 'What is a committee?',
    turns: [
      { q: 'What is a committee?', a: ['A small group of lawmakers who study bills on one subject, like health or schools. Each bill is sent to one or more of them.'], art: 'committee' },
      { q: 'Who is the chair?', a: 'The lawmaker who leads the committee. The chair decides which bills get a hearing, and when. That makes the chair a good person to write to.' },
      { q: 'Why do some bills go to several committees?', a: 'A bill that touches many things gets a committee for each. It needs a yes from each one, in order. Bills that spend money usually end at Finance in the House or Ways and Means in the Senate.' },
      { q: 'Where can I see a committee’s bills?', a: 'Every committee has a page here, with its members and the bills it has now.' },
    ],
    related: ['what-is-a-hearing', 'no-hearing-yet', 'referred'],
    act: { label: 'See the committees', href: '#/committees', icon: 'landmark' } },

  { slug: 'session-deadlines', group: 'legislature', title: 'What are the session’s big deadlines?',
    turns: [
      { q: 'What are the session’s big deadlines?', a: ['Every bill has dates to clear each step, and a bill that misses one stops for the year. The big ones have odd names.'], art: 'session' },
      { q: 'What are they, in order?', a: 'On the first side: **Triple filing**, **Lateral**, **Decking** and **Crossover**. Then the other side has its own Triple filing, Lateral and Decking, and bills must pass there too.' },
      { q: 'And at the very end?', a: '**Final decking** is the last day to file the final version of a bill. **Sine die** is the last day of the session.' },
      { q: 'Do I need to remember them?', a: 'No. Each bill’s page shows where it is and what comes next, and each hearing shows when testimony is due.' },
    ],
    related: ['triple-filing', 'crossover', 'sine-die'] },

  { slug: 'conference-committee', group: 'legislature', title: 'What is a conference committee?',
    turns: [
      { q: 'What is a conference committee?', a: ['When the House and Senate pass different versions of a bill, a few members from each side meet to agree on one. That group is the **conference committee**.'], art: 'conference' },
      { q: 'When does that happen?', a: 'In April, near the end of the session. Conference has its own deadlines, and a bill they can’t agree on by then stops for the year.' },
      { q: 'Can I still help then?', a: 'Yes. A short, polite email to your own legislators, or to the members working on the bill, still helps now.' },
    ],
    related: ['hd1-sd1', 'governor', 'email-a-legislator'] },

  { slug: 'governor', group: 'legislature', title: 'What does the Governor do with a bill?',
    turns: [
      { q: 'What does the Governor do with a bill?', a: ['Once both sides pass the same wording, the bill goes to the Governor. The Governor can sign it into law or **veto** it, which means say no.'], art: 'governor' },
      { q: 'How long does the Governor have?', a: 'For bills passed at the end of the session, until about mid-July. If the Governor does nothing, the bill becomes law without a signature.' },
      { q: 'Can a veto be undone?', a: 'Yes. Lawmakers can override a veto with a two-thirds vote in both the House and the Senate.' },
      { q: 'Can I weigh in?', a: 'Yes. You can write to the Governor’s office to ask for a signature or a veto. When HIPHI asks people to, the bill’s page here says so.' },
    ],
    related: ['how-a-bill-becomes-law', 'conference-committee', 'between-sessions'] },

  { slug: 'hb-and-sb', group: 'legislature', title: 'What do HB and SB mean?',
    turns: [
      { q: 'What do HB and SB mean?', a: ['**HB** means House Bill: it started in the House. **SB** means Senate Bill: it started in the Senate. The number is just its place in line, like HB 2121.'], art: 'hbsb' },
      { q: 'What about HR, SR, HCR and SCR?', a: 'Those are **resolutions**, not bills. A resolution says what lawmakers think, or asks someone to act. It never becomes a law.' },
      { q: 'Why is the same idea sometimes there twice?', a: 'Lawmakers often file one bill on each side with the same idea. Those are called **companion bills**.' },
    ],
    related: ['companion-bills', 'resolutions', 'hd1-sd1'] },

  { slug: 'companion-bills', group: 'legislature', title: 'What are companion bills?',
    turns: [
      { q: 'What are companion bills?', a: ['Twins: the same idea filed as a House bill and a Senate bill at the same time.'], art: 'twins' },
      { q: 'Why file it twice?', a: 'It gives the idea two chances. Both move at once, and if one stalls, the other may keep going.' },
      { q: 'Which one should I follow?', a: 'Follow the issue and you get both. A bill’s page also lists its companion, so you can see how the twin is doing.' },
      { q: 'Do I send testimony on both?', a: 'Send it for the bill that has the hearing. If both get hearings, each one needs its own testimony.' },
    ],
    related: ['hb-and-sb', 'issues-vs-bills', 'what-is-testimony'] },

  { slug: 'resolutions', group: 'legislature', title: 'What is a resolution?',
    turns: [
      { q: 'What is a resolution?', a: 'A statement from lawmakers. It says what they think, or asks someone, like a state agency, to do something, such as study a problem.' },
      { q: 'How is it different from a bill?', a: 'A bill can become law. A resolution can’t: it is **adopted**, not signed. An HR or SR stays on one side; an HCR or SCR needs both.' },
      { q: 'Can I send testimony on one?', a: 'Yes. When a resolution gets a hearing, you send testimony the same way as for a bill.' },
    ],
    related: ['hb-and-sb', 'what-is-testimony', 'how-a-bill-becomes-law'] },

  { slug: 'between-sessions', group: 'legislature', title: 'What can I do between sessions?',
    turns: [
      { q: 'What can I do between sessions?', a: 'Get ready. Follow the issues you care about now, so their new bills reach you when the next session opens on {nextOpen}.' },
      { q: 'Can I talk to lawmakers now?', a: 'Yes. It’s a good time to write to your senator and representative about what matters to you, before the session gets busy.' },
      { q: 'What about the bills that stopped?', a: 'Ideas that stopped often come back as new bills. If you follow the issue, the new ones come to you.' },
    ],
    related: ['when-is-the-session', 'my-legislators', 'what-follow-does'],
    act: { label: 'Find an issue to follow', href: '#/find', icon: 'search' } },

  // ---------------- Hearings ----------------
  { slug: 'what-is-a-hearing', group: 'hearings', title: 'What is a hearing?',
    turns: [
      { q: 'What is a hearing?', a: ['A public meeting where a committee hears from people about some bills, then decides what to do with each one.'], art: 'hearing' },
      { q: 'How do I know when one is coming?', a: 'The committee posts a notice a few days ahead. When a bill on one of your issues gets a hearing, it shows up on your Home page here.' },
      { q: 'What can the committee decide?', a: 'Pass it, pass it with changes, or put it on hold (the Capitol says **deferred**). On hold usually stops a bill for the year.' },
      { q: 'Can anyone take part?', a: 'Yes. Anyone can send written testimony, and you can ask to speak in person or on Zoom. You don’t need to be an expert.' },
    ],
    related: ['what-is-testimony', 'speak-at-hearing', 'watch-a-hearing'] },

  { slug: 'speak-at-hearing', group: 'hearings', title: 'Can I speak at a hearing?',
    turns: [
      { q: 'Can I speak at a hearing?', a: 'Yes. On the Capitol’s testimony form, choose **In person** or **Zoom** instead of written testimony only, and send it by the deadline.' },
      { q: 'What will it be like?', a: 'The chair calls on people one at a time, and speakers are often asked to keep it short. Start with where you stand, then give your main reason.' },
      { q: 'Do I have to speak?', a: 'No. Written testimony is read too, and it’s what most people send.' },
      { q: 'Can someone help me get ready?', a: `Yes. The Legislature’s Public Access Room helps for free: ${PAR}.` },
    ],
    related: ['in-person-or-zoom', 'good-testimony', 'watch-a-hearing'] },

  { slug: 'in-person-or-zoom', group: 'hearings', title: 'Should I go in person or use Zoom?',
    turns: [
      { q: 'Should I go in person or use Zoom?', a: ['Either is fine. Pick **In person** to speak at the Capitol, or **Zoom** to speak from home.'], art: 'zoom' },
      { q: 'Which is easier?', a: 'Zoom saves the trip, which matters on a neighbor island. In person, lawmakers see you in the room.' },
      { q: 'What do I need for Zoom?', a: `A phone or computer with a microphone, and a quiet spot. If you get stuck, the Public Access Room helps for free: ${PAR}.` },
    ],
    related: ['speak-at-hearing', 'getting-to-the-capitol', 'testimony-deadline'] },

  { slug: 'watch-a-hearing', group: 'hearings', title: 'Can I watch a hearing?',
    turns: [
      { q: 'Can I watch a hearing?', a: 'Yes. Many hearings stream live on YouTube, and you can watch the recording later. When there’s a link, the bill’s page shows **Watch live**.' },
      { q: 'Can I go in person?', a: 'Yes. Hearings are open to the public, at the State Capitol in Honolulu. The bill’s page shows the room and the time, and [how to get there](#/help/getting-to-the-capitol).' },
      { q: 'What if it runs late?', a: 'Hearings often do, so times can slip. Arrive early, or keep the stream open until your bill comes up.' },
    ],
    related: ['what-is-a-hearing', 'after-a-hearing', 'in-person-or-zoom'] },

  // R-142 (10/4): the facts are the ones the hearing card's directions use (pub/actions.js, GO), with their sources there.
  { slug: 'getting-to-the-capitol', group: 'hearings', title: 'How do I get to a hearing at the Capitol?',
    turns: [
      { q: 'How do I get to a hearing at the Capitol?', a: ['Hearings are at the Hawaiʻi State Capitol, 415 S Beretania St in Honolulu. Many buses stop on Beretania Street, in front of the building.', 'Driving? There’s paid parking under the Capitol (enter from Miller Street) and in the state lots nearby.'] },
      { q: 'What do I bring?', a: 'A photo ID. Security checks it and your bag on the way in, so bring as little as you can. Plan to arrive about 20 minutes early.' },
      { q: 'How do I find the room?', a: 'The first number is the floor: Room 229 is on the 2nd floor, Room 325 on the 3rd. Room 016 is on the chamber level, one floor below the open-air center.' },
      { q: 'Can the tracker remind me how?', a: 'Yes. On a hearing, tap **Go to the hearing**, then **I plan to go**. You get these steps for that room, a map, and a calendar reminder.' },
      { q: 'Who can help on the day?', a: `The Public Access Room, Room 401, helps for free: ${PAR}.` },
    ],
    related: ['in-person-or-zoom', 'speak-at-hearing', 'watch-a-hearing'] },

  { slug: 'after-a-hearing', group: 'hearings', title: 'What happens after a hearing?',
    turns: [
      { q: 'What happens after a hearing?', a: 'The committee decides, at the hearing or on a later day. Then the bill moves on, changes, or stops.' },
      { q: 'How do I find out?', a: 'The bill’s page here says what the committee decided, in plain words. If you follow its issue, your Home page shows it too.' },
      { q: 'What does “passed with amendments” mean?', a: 'The committee passed it with changes. The bill gets a new version name, like HD1, and moves to its next step.' },
    ],
    related: ['hd1-sd1', 'deferred', 'what-follow-does'] },

  { slug: 'does-testimony-matter', group: 'hearings', title: 'Does my testimony matter?',
    turns: [
      { q: 'Does my testimony matter?', a: 'Yes. Committee members read testimony before they vote, and it becomes part of the public record.' },
      { q: 'Won’t a group like HIPHI say it better?', a: 'Groups bring facts. You bring what only you know: how the bill would touch your life, your family or your work. Lawmakers listen for that.' },
      { q: 'Does one letter change a vote?', a: 'Not always on its own. But lawmakers notice how many people write, and what they say. Each letter adds to that.' },
      { q: 'Where do I start?', a: 'Follow an issue you care about. When one of its bills gets a hearing, we’ll show you the easiest way to help.' },
    ],
    related: ['what-is-testimony', 'good-testimony', 'what-follow-does'],
    act: { label: 'Find an issue to follow', href: '#/find', icon: 'search' } },

  // ---------------- Sending testimony ----------------
  { slug: 'what-is-testimony', group: 'testimony', title: 'What is testimony?',
    turns: [
      { q: 'What is testimony?', a: ['A short letter to a committee saying what you think of a bill and why. Anyone can send one, and it’s free.'], art: 'letter' },
      { q: 'How long should it be?', a: 'Short is fine. A few sentences with where you stand, who you are and why it matters to you is enough.' },
      { q: 'Where do I send it?', a: 'On the Legislature’s website, with a free account there. This tracker helps you write it, then walks you through sending it.' },
      { q: 'When is it due?', a: 'At least 24 hours before the hearing, and 48 hours for some Senate committees. Each hearing here shows its own deadline, so you don’t need to count.' },
    ],
    related: ['good-testimony', 'capitol-account', 'support-oppose-comments'] },

  { slug: 'good-testimony', group: 'testimony', title: 'How do I write good testimony?',
    turns: [
      { q: 'How do I write good testimony?', a: 'Keep it short and personal. Start with the bill number and where you stand, then say who you are.' },
      { q: 'What should I say?', a: 'Your own reason: how the bill would touch you, your family, your work or your community. One true story is worth a page of facts.' },
      { q: 'How should it start and end?', a: 'Start with “Dear Chair, Vice Chair, and members of the committee.” End with your ask, like “Please pass this bill,” then mahalo and your name.' },
      { q: 'What should I leave out?', a: 'Anything you don’t want public. Your name and letter are posted online, and you don’t have to share health details to be heard.' },
    ],
    related: ['testimony-public', 'support-oppose-comments', 'testimony-deadline'] },

  { slug: 'testimony-deadline', group: 'testimony', title: 'When is testimony due?',
    turns: [
      { q: 'When is testimony due?', a: ['At least 24 hours before the hearing starts, and 48 hours for some Senate committees.'], art: 'deadline' },
      { q: 'How do I know the exact time?', a: 'Each hearing here shows its own deadline, with the day and the time. You never have to count.' },
      { q: 'Can you remind me?', a: 'Yes. Add your email and choose to be kept updated, and we’ll email you when a bill on your issues gets a hearing.' },
    ],
    related: ['missed-deadline', 'alerts-and-email', 'what-is-testimony'] },

  { slug: 'missed-deadline', group: 'testimony', title: 'I missed the deadline. Now what?',
    turns: [
      { q: 'I missed the deadline. Now what?', a: 'You can still send it. Late testimony is taken, but it’s marked late and may not be read before the vote.' },
      { q: 'Is there anything faster?', a: 'Yes. A short email to the committee’s chair can reach them before the vote. The bill’s page offers one, ready to change and send.' },
      { q: 'How do I avoid this next time?', a: 'Follow the issue, and add your email to hear when a hearing is set. Notices usually come a few days ahead.' },
    ],
    related: ['testimony-deadline', 'email-a-legislator', 'alerts-and-email'] },

  { slug: 'capitol-account', group: 'testimony', title: 'Do I need an account to send testimony?',
    turns: [
      { q: 'Do I need an account to send testimony?', a: 'Yes, a free one on the Legislature’s website. You make it once, then use it every time.' },
      { q: 'How do I make one?', a: 'On the Capitol page, choose **Submit Testimony**, then **Register**. Enter your name, your email and a new password, then open the link they email you.' },
      { q: 'The email hasn’t come. Now what?', a: `It can take a few minutes, so look in spam or promotions. Still nothing? The Public Access Room helps for free: ${PAR}.` },
      { q: 'Do I need an account on this tracker too?', a: 'No. You can follow issues and write testimony here without one.' },
    ],
    related: ['support-oppose-comments', 'green-box', 'tracker-account'] },

  { slug: 'support-oppose-comments', group: 'testimony', title: 'Support, oppose or comments?',
    turns: [
      { q: 'Support, oppose or comments?', a: 'The Capitol’s form asks where you stand. **Support** means you want the bill passed. **Oppose** means you don’t.' },
      { q: 'When do I choose Comments?', a: 'When you’re not for or against it, or you’d support it with changes. Say what you’d change and why.' },
      { q: 'What does “Individual” mean on the form?', a: 'That you speak for yourself, not for a group. Pick it unless an organization asked you to testify for it.' },
      { q: 'Does my stance have to match HIPHI’s?', a: 'No. It’s your testimony. The tracker helps you write it in your own words, whatever you think.' },
    ],
    related: ['good-testimony', 'disagree', 'capitol-account'] },

  { slug: 'green-box', group: 'testimony', title: 'What is the green box?',
    turns: [
      { q: 'What is the green box?', a: ['After you submit testimony on the Capitol website, a **green box** appears. It means your testimony went through.'], art: 'greenbox' },
      { q: 'I didn’t see it. What happened?', a: 'It may not have gone through. The Capitol site logs you out after 60 minutes, so log in again and submit it again. Your letter is still saved in the tracker.' },
      { q: 'Who can help?', a: `The Public Access Room, the Legislature’s own helpers, for free: ${PAR}.` },
    ],
    related: ['stuck-on-capitol-site', 'capitol-account', 'testimony-public'] },

  { slug: 'testimony-public', group: 'testimony', title: 'Is my testimony public?',
    turns: [
      { q: 'Is my testimony public?', a: 'Yes. The Capitol posts your name and your letter online, with the hearing.' },
      { q: 'What about my email?', a: 'The tracker never adds your email to your letter. Share only what you’re comfortable with.' },
      { q: 'Do I have to share my health story?', a: 'No. You don’t have to share health details to be heard. Saying you live here and care about the bill is enough.' },
    ],
    related: ['good-testimony', 'data-private', 'does-testimony-matter'] },

  { slug: 'stuck-on-capitol-site', group: 'testimony', title: 'I’m stuck on the Capitol website',
    turns: [
      { q: 'I’m stuck on the Capitol website', a: 'That happens. Your letter stays saved in the tracker, so nothing is lost. Try again from the bill’s page.' },
      { q: 'Why did it log me out?', a: 'The Capitol site logs you out after 60 minutes. Log in again, paste your letter and submit.' },
      { q: 'I can’t find the hearing on the form.', a: `The Public Access Room can help you find it, for free: ${PAR}.` },
    ],
    related: ['green-box', 'capitol-account', 'missed-deadline'] },

  // ---------------- Talking to lawmakers ----------------
  { slug: 'my-legislators', group: 'lawmakers', title: 'Who are my legislators?',
    turns: [
      { q: 'Who are my legislators?', a: ['Everyone in Hawaiʻi has two: one **senator** and one **representative**. Which two depends on where you live.'], art: 'districts' },
      { q: 'How do I find mine?', a: 'Type your home address and we’ll show them. The address is used only to find your districts, and it isn’t saved.' },
      { q: 'Why do my own legislators matter?', a: 'They answer to the people who vote for them. A note from someone in their district carries extra weight.' },
    ],
    related: ['email-a-legislator', 'what-is-the-legislature', 'data-private'],
    act: { label: 'Find my legislators', href: '#/legislators', icon: 'users' } },

  { slug: 'email-a-legislator', group: 'lawmakers', title: 'Should I email a lawmaker?',
    turns: [
      { q: 'Should I email a lawmaker?', a: 'Yes, it’s a quick way to help. A short, polite note saying where you stand on a bill, and why, is enough.' },
      { q: 'Who should I write to?', a: 'Before a hearing, the chair of that committee. Any time, your own senator and representative.' },
      { q: 'Does this tracker send it for me?', a: 'No. We write a short draft, and it opens in your own email app. You change what you like and send it yourself.' },
      { q: 'Is an email the same as testimony?', a: 'No. Testimony goes on the Capitol website and joins the public record for the hearing. An email goes only to the lawmaker. When there’s a hearing, testimony is the stronger step.' },
    ],
    related: ['my-legislators', 'no-hearing-yet', 'what-is-testimony'] },

  { slug: 'no-hearing-yet', group: 'lawmakers', title: 'My bill has no hearing. Can I help?',
    turns: [
      { q: 'My bill has no hearing. Can I help?', a: 'Yes. The committee’s chair decides which bills get a hearing. A short, polite email asking the chair to hear the bill can help.' },
      { q: 'How do I do that here?', a: 'On the bill’s page, choose **Ask the chair for a hearing**. We write a short draft, and it opens in your own email app to change and send.' },
      { q: 'Is there a deadline?', a: 'Yes. Each bill has to clear its committees by set dates, so asking early is best.' },
    ],
    related: ['what-is-a-committee', 'session-deadlines', 'email-a-legislator'] },

  // ---------------- Words you'll see ----------------
  { slug: 'deferred', group: 'words', title: 'What does “deferred” mean?',
    turns: [
      { q: 'What does “deferred” mean?', a: ['Put on hold. When a committee defers a bill, it usually stops for the year.'], art: 'deferred' },
      { q: 'It says “deferred until” a date. Is that different?', a: 'Yes. That only moves the decision to that day. The bill is still alive until then.' },
      { q: 'Can a deferred bill come back?', a: 'Sometimes. The idea can return in a new bill, or in the second year of lawmakers’ two-year term.' },
    ],
    related: ['after-a-hearing', 'why-bills-stop', 'no-hearing-yet'] },

  { slug: 'triple-filing', group: 'words', title: 'What is Triple filing?',
    turns: [
      { q: 'What is Triple filing?', a: ['An early deadline for bills sent to three or more committees. By then, the bill must be through all but its last two.'], art: 'path:triple' },
      { q: 'When is it?', a: 'In mid-February on the first side, and in March on the other. The exact dates change each year.' },
      { q: 'What if a bill misses it?', a: 'It stops for the year. That’s why an early hearing matters so much for a bill with many committees.' },
    ],
    related: ['lateral', 'decking', 'session-deadlines'] },

  { slug: 'lateral', group: 'words', title: 'What is Lateral?',
    turns: [
      { q: 'What is Lateral?', a: ['A deadline. By Lateral, a bill must be through every committee on that side except its last one.'], art: 'path:lateral' },
      { q: 'When is it?', a: 'In late February on the first side, and in late March on the other.' },
      { q: 'What if a bill misses it?', a: 'It stops for the year.' },
    ],
    related: ['triple-filing', 'decking', 'session-deadlines'] },

  { slug: 'decking', group: 'words', title: 'What is Decking?',
    turns: [
      { q: 'What is Decking?', a: ['A deadline. By Decking, a bill must be through all its committees on that side and filed for the full vote.'], art: 'path:decking' },
      { q: 'When is it?', a: 'In early March on the first side, and in early April on the other. The state budget has its own dates.' },
      { q: 'What comes after?', a: 'A vote by everyone on that side, and then **Crossover**.' },
    ],
    related: ['crossover', 'third-reading', 'session-deadlines'] },

  { slug: 'crossover', group: 'words', title: 'What is Crossover?',
    turns: [
      { q: 'What is Crossover?', a: ['The deadline for a bill to pass its first side. Bills that pass cross over to the other side and start again there.'], art: 'path:crossover' },
      { q: 'When is it?', a: 'In mid-March, about halfway through the session.' },
      { q: 'What does “cross back” mean?', a: 'In mid-April, bills must pass the second side too. If that side changed the bill, it goes back to the first side, which agrees or sends it to conference.' },
    ],
    related: ['conference-committee', 'decking', 'session-deadlines'] },

  { slug: 'sine-die', group: 'words', title: 'What does “sine die” mean?',
    turns: [
      { q: 'What does “sine die” mean?', a: 'The last day of the session. It’s Latin for “without a day”: the Legislature ends without setting a day to meet again.' },
      { q: 'When is it?', a: 'In early May. In 2026 it was May 8.' },
      { q: 'What happens to bills after that?', a: 'Bills that passed both sides go to the Governor. Bills still on the way stop moving for the year.' },
    ],
    related: ['governor', 'when-is-the-session', 'between-sessions'] },

  { slug: 'hd1-sd1', group: 'words', title: 'What do HD1, SD1 and CD1 mean?',
    turns: [
      { q: 'What do HD1, SD1 and CD1 mean?', a: ['They’re version names. **HD1** is the first House draft: a House committee changed the bill once. **SD1** is the first Senate draft.'], art: 'drafts' },
      { q: 'And CD1?', a: 'The **conference draft**: the version the House and Senate agree on in conference.' },
      { q: 'Which version is the real one?', a: 'The newest. Write about the version the committee is hearing, which the hearing notice names.' },
    ],
    related: ['after-a-hearing', 'conference-committee', 'hb-and-sb'] },

  { slug: 'referred', group: 'words', title: 'What does “referred to” mean?',
    turns: [
      { q: 'What does “referred to” mean?', a: 'Sent to committees. When a bill is **referred**, it goes to the committees that will study it, in order.' },
      { q: 'What are the short codes, like FIN?', a: 'Committee names, shortened. FIN is the House Finance committee, and WAM is the Senate’s Ways and Means. Each committee’s page here has its full name.' },
      { q: 'Can the list change?', a: 'Yes, a bill can be sent to different committees. The bill’s page always shows the path it’s on now.' },
    ],
    related: ['what-is-a-committee', 'triple-filing', 'hb-and-sb'] },

  { slug: 'third-reading', group: 'words', title: 'What is third reading?',
    turns: [
      { q: 'What is third reading?', a: 'The final vote on one side. A bill is read three times on each side, and at the third, everyone votes on it.' },
      { q: 'Where does it happen?', a: 'On the floor: the whole House or the whole Senate, meeting at the Capitol.' },
      { q: 'Can I speak at a floor vote?', a: 'No. The public speaks at committee hearings. Before a floor vote, an email to your own legislators is the way to be heard.' },
    ],
    related: ['crossover', 'email-a-legislator', 'my-legislators'] },

  // ---------------- Using this tracker ----------------
  { slug: 'what-follow-does', group: 'tracker', title: 'What does Follow do?',
    turns: [
      { q: 'What does Follow do?', a: ['It keeps an issue’s bills in view. Follow an issue, like free school meals, and every bill HIPHI works on for it comes to you.'], art: 'follow' },
      { q: 'Where do they show up?', a: 'In **My issues**, and on your Home page when something happens, like a hearing.' },
      { q: 'What if I don’t want one of the bills?', a: 'Choose **Not for me** on that bill. It drops that bill and keeps the issue.' },
      { q: 'Does following send anything?', a: 'No. Following never sends anything to a lawmaker. It only changes what you see here.' },
    ],
    related: ['issues-vs-bills', 'alerts-and-email', 'where-you-stand'],
    act: { label: 'Find an issue to follow', href: '#/find', icon: 'search' } },

  { slug: 'issues-vs-bills', group: 'tracker', title: 'What’s the difference between an issue and a bill?',
    turns: [
      { q: 'What’s the difference between an issue and a bill?', a: 'A **bill** is one proposed law with a number, like HB 2121. An **issue** is the idea behind it, like the disposable e-cigarette ban.' },
      { q: 'Why follow issues, not bills?', a: 'One idea often has several bills: a House twin, a Senate twin, next year’s version. Following the issue brings in all of them.' },
      { q: 'Can I still follow one bill?', a: 'Yes. If a bill isn’t part of an issue, you can follow it on its own.' },
    ],
    related: ['what-follow-does', 'companion-bills', 'hb-and-sb'] },

  { slug: 'alerts-and-email', group: 'tracker', title: 'How do email updates work?',
    turns: [
      { q: 'How do email updates work?', a: 'Add your email and choose to be kept updated. We’ll email you when a bill on your issues gets a hearing, and when HIPHI has news or a way to help.' },
      { q: 'How often?', a: 'Hearing emails come about 2 days ahead, with time to send testimony. HIPHI’s updates come a few times a session.' },
      { q: 'Can I stop them?', a: 'Yes. Every email has a one-click unsubscribe, and your profile (under More) lets you turn each kind off.' },
      { q: 'Do I need a password?', a: 'No. We email you a link to sign in, so there’s no password to remember.' },
    ],
    related: ['tracker-account', 'data-private', 'testimony-deadline'],
    act: { label: 'Add my email', href: '#/signin', icon: 'mail-check' } },

  { slug: 'tracker-account', group: 'tracker', title: 'Do I need to sign up to use this?',
    turns: [
      { q: 'Do I need to sign up to use this?', a: 'No. You can follow issues, read every bill and write testimony without signing up. What you follow stays in this browser.' },
      { q: 'Why add my email, then?', a: 'So your issues are kept on any device, and so we can tell you when there’s a hearing. Phones sometimes clear what a website saved.' },
      { q: 'Is it free?', a: 'Yes. The tracker is free, from the Hawaiʻi Public Health Institute.' },
    ],
    related: ['alerts-and-email', 'data-private', 'what-is-hiphi'] },

  { slug: 'where-you-stand', group: 'tracker', title: 'Why does a bill ask where I stand?',
    turns: [
      { q: 'Why does a bill ask where I stand?', a: 'So the tracker can help you the right way. On any bill’s page you can say **support**, **oppose** or **not sure yet**.' },
      { q: 'What changes when I answer?', a: 'Your testimony follows your view. If you disagree with HIPHI, we help you say so in your own words.' },
      { q: 'Who sees my answer?', a: 'If you haven’t added your email, it stays on this device. If you have, only you and HIPHI staff see it, like the issues you follow. Others see only totals.' },
    ],
    related: ['disagree', 'support-oppose-comments', 'data-private'] },

  { slug: 'share-a-bill', group: 'tracker', title: 'How do I share a bill with a friend?',
    turns: [
      { q: 'How do I share a bill with a friend?', a: 'On the bill’s page, choose **Share** or **Copy link**. The link shows the bill’s name when you send it in a text or a post.' },
      { q: 'What will my friend see?', a: 'The bill’s page, with a short welcome if they’re new here, and the easiest way to help.' },
      { q: 'Does sharing really help?', a: 'Yes. Every person who hears about a bill is one more who can speak up.' },
    ],
    related: ['what-follow-does', 'does-testimony-matter', 'what-is-testimony'] },

  // ---------------- About HIPHI and your data ----------------
  { slug: 'what-is-hiphi', group: 'hiphi', title: 'What is HIPHI?',
    turns: [
      { q: 'What is HIPHI?', a: 'The **Hawaiʻi Public Health Institute**, a nonprofit that works for a healthier Hawaiʻi. It made this tracker, and the tracker is free.' },
      { q: 'What does HIPHI work on?', a: 'In this tracker, six topics: food and nutrition; tobacco, nicotine and alcohol; health care; family and economic security; getting around safely; and climate.' },
      { q: 'Where can I learn more?', a: `At [hiphi.org](https://www.hiphi.org/about/), or email ${EMAIL}.` },
    ],
    related: ['why-positions', 'disagree', 'contact'] },

  { slug: 'why-positions', group: 'hiphi', title: 'Why does HIPHI take positions on bills?',
    turns: [
      { q: 'Why does HIPHI take positions on bills?', a: 'HIPHI studies bills that touch health and says where it stands, so you have a place to start. Positions marked HIPHI are HIPHI’s own.' },
      { q: 'Does HIPHI speak for me?', a: 'No. You speak for yourself. Your testimony goes in your own name, in your own words.' },
      { q: 'Why does HIPHI follow only some bills?', a: 'It works on the bills with the most to do with health. You can still search every bill in the session here.' },
    ],
    related: ['disagree', 'what-is-hiphi', 'where-you-stand'] },

  { slug: 'disagree', group: 'hiphi', title: 'Can I disagree with HIPHI?',
    turns: [
      { q: 'Can I disagree with HIPHI?', a: 'Of course. Your view is yours. Say where you stand on a bill’s page, and the tracker helps you either way.' },
      { q: 'Will the tracker still help me testify?', a: 'Yes. We help you write in your own words, and send you to the Capitol’s own form.' },
      { q: 'Will HIPHI know?', a: 'Only if you’ve added your email. Then HIPHI staff can see where you stand on the bills you follow.' },
    ],
    related: ['where-you-stand', 'support-oppose-comments', 'data-private'] },

  { slug: 'data-private', group: 'hiphi', title: 'Is my data private?',
    turns: [
      { q: 'Is my data private?', a: 'If you don’t add your email, we don’t know who you are. What you follow stays in this browser, on this device.' },
      { q: 'And if I add my email?', a: 'We keep your email, what you follow, where you stand and the actions you mark. HIPHI staff can see this, so they can reach out about your issues.' },
      { q: 'Is it ever sold?', a: 'No. We never sell your information or give it to other groups. You can delete your account at any time from your profile, under More.' },
      { q: 'What about my home address?', a: 'If you add it, only you see it. HIPHI staff see just your districts.' },
    ],
    related: ['testimony-public', 'alerts-and-email', 'contact'],
    act: { label: 'Read the privacy page', href: '#/privacy', icon: 'lock' } },

  { slug: 'contact', group: 'hiphi', title: 'How do I reach a real person?',
    turns: [
      { q: 'How do I reach a real person?', a: `For help with the tracker or HIPHI’s work, email ${EMAIL}.` },
      { q: 'And for help with testifying?', a: `Call the Public Access Room, the Legislature’s own free helpers: ${PAR}. You can also visit them at the State Capitol.` },
    ],
    related: ['what-is-hiphi', 'stuck-on-capitol-site', 'data-private'] },
];
