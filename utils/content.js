const div = $(`<div class="xl-jira"><i class="close"></i><div class="xl-msg"></div></div>`);
$('body').append(div);

chrome.runtime.onMessage.addListener(({ type, data }, sender, sendResponse) => {
  if (type === 3 && data.length) {
    const newUrl = chrome.runtime.getURL('icons/new.png');
    const as = data.map((e) => `<a href="${e.key}" target="_blank">${e.value}</a>`);
    const inner = `
      <div class="msg-title"><img src="${newUrl}">你有${data.length}条新的jira任务</div>
      <div class="msg-content">${as.join('')}</div>
    `;
    $('.xl-msg').html(inner);
    $('.xl-jira').addClass('active');
  }
});

// 监听点击后反馈给background
$('.xl-jira').on('click', 'a', () => {
  $('.xl-jira').removeClass('active');
  $('.xl-msg').html('');
  chrome.runtime.sendMessage({ type: 4 });
});

$('.close').click(() => {
  $('.xl-jira').removeClass('active');
  $('.xl-msg').html('');
  chrome.runtime.sendMessage({ type: 4 });
});
