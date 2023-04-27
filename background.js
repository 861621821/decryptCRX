let cookie = '';
let error = ''; // 错误信息
let records = []; // 记录接口信息

// 监听content_script传过来的事件
chrome.runtime.onMessage.addListener(({ action, data }, sender, sendResponse) => {
  switch (action) {
  case 'open':
    // 打开新标签
    chrome.tabs.create({
      url: '' // https://baidu.com
    });
    chrome.storage.local.set({ done: true });
    sendResponse({ status: 'ok' });
    break;
  case 'decrypt':
    console.log(data);
    break;
  }
});

// 获取cookie
// (function() {
//   const urls = [
//     'http://unionpay.cn',
//     // '*://unionpay.pingpptest.com/*'
//   ];
//   const promises = [];
  
//   for (let i = 0; i < urls.length; i++) {
//     promises.push(
//       new Promise((resolve) => {
//         chrome.cookies.getAll({url: urls[i]}, function(result) {
//           resolve(result);
//         });
//       })
//     );
//   }
  
//   Promise.all(promises).then((results) => {
//     const cookies = results.flat();
//     const authorization = cookies.find(e => e.name === '_authorization');
//     authorization && (cookie = authorization.value);
//     if (authorization && authorization.value) {
//       cookie = authorization.value;
//     } else {
//       error = '获取cookie异常';
//     }
//   });
// })();


// const sendMessageToPopup = (data) => {
//   console.log('back:',data);
//   chrome.runtime.sendMessage({data}, (response) => {
//     console.log(response);
//   });
// };

const formatRequestBody = ({ url, method, requestBody }) => {
  if (method === 'POST' || method === 'PUT') {
    const buffer = requestBody.raw[0].bytes;
    const decoder = new TextDecoder();
    const str = decoder.decode(new Uint8Array(buffer));
    records.push({
      method,
      url,
      data: JSON.parse(str)
    });
  }
};

(function() {
  const urls = [
    '*://unionpay.cn/*',
    '*://unionpay.pingpptest.com/*',
    '*://mcs.snssdk.com/*'
  ];
  // 监听浏览器请求
  chrome.webRequest.onBeforeRequest.addListener(
    formatRequestBody,
    {urls, types: ['xmlhttprequest']},
    ['requestBody']
  );
})();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    // 处理浏览器弹出窗口打开事件
    // sendrecords();
    chrome.runtime.sendMessage({type: 1, records}, (response) => {
    // 处理响应
    });
  }
});

chrome.runtime.onMessage.addListener(({ type }, sender, sendResponse) => {
  switch (type) {
  case 2:
    // 清空记录
    records = [];
    break;
  
  default:
    break;
  }
  sendResponse({status: 2});
});