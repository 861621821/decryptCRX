let cookie = '';
let error = ''; // 错误信息
let records = []; // 记录接口信息
let jiraMap = {};

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
    chrome.storage.local.get('length', (res) => {
      const length = res.length || 20;
      records.push({
        method,
        url,
        data: JSON.parse(str),
      });
      records = records.slice(-length);
    });
  }
};

(function () {
  // 监听浏览器请求
  chrome.webRequest.onBeforeRequest.addListener(formatRequestBody, { urls: ['<all_urls>'], types: ['xmlhttprequest'] }, ['requestBody']);
})();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    // 处理浏览器弹出窗口打开事件
    chrome.storage.local.get('length', (res) => {
      const length = res.length || 20;
      chrome.runtime.sendMessage({ type: 1, data: { records, length } });
    });
  }
});

chrome.runtime.onMessage.addListener(({ type, data }, sender, sendResponse) => {
  switch (type) {
    case 2:
      // 清空抓包记录
      records = [];
      break;

    case 4:
      // 标记已读
      chrome.storage.local.set({ jiraMap });
      break;

    case 5:
      // 修改缓存数量
      records = records.slice(-data);
      chrome.storage.local.set({ length: data });
      chrome.storage.local.get('length', (res) => {
        const length = res.length || 20;
        chrome.runtime.sendMessage({ type: 1, data: { records, length } });
      });
      break;

    case 99:
      // 打开新标签
      chrome.tabs.create({
        url: '', // https://baidu.com
      });
      chrome.storage.local.set({ done: true });
      break;

    default:
      break;
  }
  sendResponse({ status: 2 });
});

const notify = (map) => {
  const keys = Object.keys(map);
  let data = keys.map((key) => {
    return { key: key, value: map[key] };
  });
  // 通知content
  keys.length &&
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 3, data });
      }
    });
};

// jira提醒
let jiraNotify = true;
if (jiraNotify) {
  const jiraList = {};
  (function () {
    const formatJira = (str) => {
      jiraMap = {};
      const regex = /<td\s+class="summary">\s*<p>(\s*<a[^>]+>(.*?)<\/a>\s*)*<\/p>\s*<\/td>/g;
      const results = str.match(regex);
      results.forEach((e) => {
        const regex = /<a.*?href="(.*?)".*?>(.*?)<\/a>/g;
        const temp = e.match(regex).pop();
        const match = regex.exec(temp);
        const href = match[1];
        const text = match[2];
        // 缓存jira列表
        jiraMap[href] = text;
      });
      chrome.storage.local.get('jiraMap', (res) => {
        const tempMap = JSON.parse(JSON.stringify(jiraMap));
        Object.keys(res.jiraMap || {}).forEach((key) => {
          delete tempMap[key];
        });
        notify(tempMap);
      });
    };

    // 获取jira分配给我的信息
    const queryJira = () => {
      fetch(
        `https://jira.internal.pingxx.com/rest/gadget/1.0/issueTable/jql?num=10&tableContext=jira.table.cols.dashboard&addDefault=false&columnNames=issuetype&columnNames=issuekey&columnNames=summary&columnNames=assignee&columnNames=reporter&columnNames=status&columnNames=priority&enableSorting=true&paging=true&showActions=true&jql=assignee+%3D+currentUser()+AND+resolution+%3D+unresolved+ORDER+BY+priority+DESC%2C+created+ASC&sortBy=&startIndex=0&_=${Date.now()}`
      )
        .then((response) => response.json())
        .then((data) => {
          const str = data?.table;
          formatJira(str);
        })
        .catch((error) => {
          console.error(error);
        });
    };
    queryJira(true);
    setInterval(queryJira, 10000);
  })();
}
