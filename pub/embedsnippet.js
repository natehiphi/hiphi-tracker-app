// The copy-paste code that puts embed.html on another website (R-212 #38). One maker for the public page (#/embed,
// pub/embedcode.js) and the staff screens (staff/coalition.js, staff/list.js, staff/setup.js), so a fix reaches every copy.
// Two things the old code got wrong, from the Partner Staffer's walk (8 Oct):
// - min-height:420px left a blank gap under a short list (three bills drew about 250px), and the frame never shrank after
//   a search, because the page reported the frame's own height back. Now the frame starts at 480px and takes exactly the
//   height embed.html reports (the content's, not the window's).
// - id="hiphi-tracker" meant a second table on the same page resized the first. The script now matches the message to the
//   frame it came from. embed.html still posts the same message, so code pasted before keeps working.
export function embedSnippet(src, title = 'HIPHI bill tracker') {
  const t = String(title).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<iframe data-hiphi-tracker src="${src.replace(/"/g, '%22')}" title="${t}" style="width:100%;height:480px;border:0" loading="lazy"></iframe>\n`
    + `<script>addEventListener('message',function(e){var h=e.data&&e.data.hiphiTrackerHeight;if(!h)return;document.querySelectorAll('iframe[data-hiphi-tracker]').forEach(function(f){if(f.contentWindow===e.source)f.style.height=h+'px'})})<\/script>`;
}
