const div = $(`<div class="xl-model"><div class="xl-jira"></div></div>`);

chrome.runtime.onMessage.addListener(({ type, data }, sender, sendResponse) => {
  if (type === 3 && data.length) {
    const newUrl = chrome.runtime.getURL('icons/new.png');
    const as = data.map((e) => `<a data-jira="true" class="jira-item" href="${e.key}" target="_blank" title="${e.value}">${e.value}</a>`);
    const inner = `
      <i class="close"></i>
      <div class="xl-msg">
        <div class="msg-title"><img src="${newUrl}">你有<span> ${data.length} </span>条新的jira任务</div>
        <div class="msg-content">${as.join('')}</div>
      </div>
    `;
    $('body').append(div);
    $('.xl-jira').html(inner);
  } else if (type === 6) {
    const inner = `
      <div class="xl-login">
        <div>jira未登陆或登陆已过期</div>
        <div class="login-btn"><a href="https://jira.internal.pingxx.com/login.jsp" target="_blank">重新登陆</a></div>
      </div>
      `;
    $('body').append(div);
    $('.xl-jira').html(inner);
  }
});

// 监听点击后反馈给background
$('body').on('click', '.jira-item', () => {
  $('.xl-model').remove();
  chrome.runtime.sendMessage({ type: 4 });
});

$('body').on('click', '.close', () => {
  $('.xl-model').remove();
  chrome.runtime.sendMessage({ type: 4 });
});

$('body').on('click', '.login-btn', () => {
  $('.xl-model').remove();
});
