// Staff7 Help (R-398 piece 12): the guides' words. One entry per how-to, checked against the real button and step names in staff7 on 22 Nov.
// **bold** marks a button, a step or a place exactly as the app spells it. Plain words, no outside links.
export const GUIDES = {
  testimony: { title: 'Write and file testimony', line: 'From the step Write testimony to Yes, filed.', need: 'You need this when a bill you lead has a hearing and HIPHI will testify.', steps: [
    'On **Home**, under **To do**, open the step **Write testimony** for the bill.',
    'Press **Make the testimony**. It starts from HIPHI’s template or an earlier testimony and takes a few minutes.',
    'Press **Open the testimony**. It opens in Google Docs. Read it and make it yours. Then come back here.',
    'Press **Send for approval**. An admin gets the step **Approve testimony**. If it comes back with a note, open the step **Resubmit testimony**, fix it and press **Resubmit**.',
    'When it is approved you get the step **File testimony**. Press **Submit on the Capitol site**, attach the PDF (**Download the PDF** is on the same page), then come back.',
    'Press **Yes, filed**. If you filed it another way, press **I already filed it**.',
    'If the bill’s position changed after approval, the step **Check your testimony** comes first. Press **Keep it as written** or **Change the testimony**.'] },
  sort: { title: 'Sort new bills', line: 'Track a bill, or say it is not for us.', need: 'You need this when new bills arrive each night and someone has to decide which ones we track.', steps: [
    'On **Issues**, open **New bills**.',
    'Open a bill. Read **What it does**, **Introduced by** and **Referred to**. **The Capitol’s page** and **Read the bill** are at the top.',
    'Pick a **Position**, an **Issue** (or **No issue yet**), a **Coalition** and a **Lead**. Suggested choices are filled in for you.',
    'Press **Track** to put the bill on our list. Only the team sees it until someone publishes words for the public site.',
    'Press **Not for us** if it is not our work. Press **Skip for now** if you cannot tell yet. Nothing is lost either way.',
    'The keys T, N and S do the same three jobs. When the list is empty it says **All sorted**.'] },
  ask: { title: 'Ask for a hearing', line: 'Write to the chair, then follow up.', need: 'You need this when a bill we track has not been given a hearing and its deadline is coming.', steps: [
    'On **Home**, open the step **Ask for a hearing**. The page says which bill and which committee, and by when.',
    'Read **Your email to the chair**. It is written for you. Change it if you like.',
    'Press **Open in my mail app**. If the message is long, the button says **Copy the message**: paste it into your mail.',
    'Send it from your own mail. Then come back and press **Yes, sent**. If you sent it earlier, press **I already sent it**.',
    'When the chair answers, open the step **Did the chair reply?** and pick **Will schedule**, **Said no** or **No answer yet**. No answer yet reminds you again in a few working days.',
    'No answer? You get the step **Follow up with the chair**. Press **Open in my mail app** again, or **Ask the vice chair**.',
    'If the chair says no, you can press **Ask partners and the public**, which opens public mode for the bill, or **Leave it for now**.'] },
  public: { title: 'Write public words', line: 'Nickname, summary, talking points and the ask.', need: 'You need this when the public site should say something new about a bill, or stop saying it.', steps: [
    'Open **More**, then **Public words**, and pick the bill. On a bill’s own page, press **Change what the public sees**.',
    'The top of the page says **You are changing the public site**. Fill in the **Nickname**, then the **Summary**: one sentence a neighbor would understand.',
    'Under **Talking points**, write your points. Press **Add a point** for another. People send these in their own name, so keep them true.',
    'To ask for action, write it in **HIPHI asks:** and set **Show the ask through**. The ask comes down by itself after that day.',
    'Check **How the public site will show it**. It is a picture, not the real page.',
    'Press **Publish to the public site**. If someone else must say yes, they see **Waiting for you to approve**. Not ready? Press **Save for later**, or **Discard changes**.',
    'Press **Leave public mode** to go back to where you were.'] },
  alerts: { title: 'Set your alerts', line: 'Where alerts reach you, and when.', need: 'You need this once, and again if you change how you like to be reached.', steps: [
    'Press your initials: at the bottom of the left side on a laptop, at the top right of Home on a phone.',
    'Press **My alerts**.',
    'Under **Where should alerts reach you?** pick **Slack**, **Email** or **Both**. It saves as soon as you pick.',
    'Press **Send me a test message** to check it arrives. If it does not, message Nate in Slack.',
    'To pick a place for each kind of alert, open **Choose for each kind** and tick **Slack** or **Email** on each row.',
    'If you lead bills, open **When deadline alerts arrive**. Switch each alert on or off and set its time. **Use the team’s times** puts them back.'] },
  legislator: { title: 'Talk with a legislator', line: 'Log a talk, follow up, and where they stand.', need: 'You need this when you speak or write to a legislator and want the team to know what was said.', steps: [
    'Open **More**, then **Legislators**, and find the legislator. Their phone, email and staffer are at the top of their page.',
    'After you talk, press **Log a talk** and write what was said.',
    'If it was about a bill, pick the bill. This is optional.',
    'To remind yourself, set **Follow up by** to a date. It shows under **Now with** them on their page, for you, from that day.',
    'To record where they stand on a bill, find the bill on their page and press **Change** (or **Set**) next to it.'] },
};
export const ORDER = ['testimony', 'sort', 'ask', 'legislator', 'public', 'alerts'];   // the drawing's order
export const MORE_ROWS = [
  { id: 'where', title: 'What each place is for', line: 'Each door, each place in More, and your alerts.' },
  { id: 'words', title: 'What the Capitol’s words mean', line: 'Crossover, decking, sine die and the rest, in plain language.' },
];
export const WHERE = {
  line: 'What each door and each place in More is for.',
  doors: [['Home', 'Your steps for today, what waits on others, and suggested steps.'], ['Issues', 'Your issues and their bills, all bills, and New bills to sort.'], ['Calendar', 'Hearings and deadlines, day by day.'], ['Search', 'Find a bill, a committee or a person.'], ['More', 'The places below, which have no steady way in.']],
  more: [['Team', 'Late steps, and bills with no lead.'], ['Public words', 'Change what the public site says about a bill.'], ['Legislators', 'How to reach each legislator, and our bills with them.'], ['Committees', 'Each committee, its chair and its hearings.'], ['Help', 'How to do the main jobs, and what the Capitol’s words mean.']],
  you: [['My alerts', 'Where alerts reach you, and when. Press your initials, then My alerts.']],
};
