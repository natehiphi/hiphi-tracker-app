// My issues (#/my-issues, R-263): the main menu's place for the issues a person owns or helps on. On 12 Oct it became each
// issue with its bills; Nate 10/16 found the list before it better organized ("Can we return to what it was?"), so it is
// that list again: your issues, where each stands in getting ready for 2027, the ones you help on, and your drafts (prep.js).
// The bills on your issues are still yours in Bills > Mine, on Today and in the inbox (data.js isMine; migrations 172, 180).
import { mineRender } from './prep.js';

export default {
  tab: 'myissues',
  title: () => 'My issues',
  render: () => mineRender({ top: true }),
  wire() {},
};
