let error = ''; // 错误信息
let records = []; // 记录接口信息
let jiraMap = {};

// 获取当前标签下的cookie
const getCookie = () => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        chrome.cookies.getAll({ url: tabs[0].url }, (cookies) => {
          const authorization = cookies.find((e) => e.name === '_authorization');
          let cookie = authorization && authorization.value;
          if (cookie) {
            let res = cookie.slice(cookie.length - 16);
            resolve(res);
          } else {
            resolve(null);
          }
        });
      }
    });
  });
};

const formatRequestBody = ({ url, method, requestBody }) => {
  if (method === 'POST' || method === 'PUT') {
    const buffer = requestBody && requestBody.raw && requestBody.raw[0].bytes;
    if (buffer) {
      const decoder = new TextDecoder();
      const str = decoder.decode(new Uint8Array(buffer));
      chrome.storage.local.get('length', async (res) => {
        const length = res.length || 20;
        let data = '';
        try {
          data = JSON.parse(str);
        } catch (error) {
          data = str;
        }
        const cookie = await getCookie();
        records.push({
          method,
          url,
          data,
          cookie,
        });
        records = records.slice(-length);
      });
    }
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
        url: data, // https://baidu.com
      });
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
          if (data?.table) {
            formatJira(data?.table);
          } else {
            // 未登陆 登陆过期
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 6 });
              }
            });
          }
        })
        .catch((error) => {
          console.error(error);
        });
    };
    queryJira(true);
    setInterval(queryJira, 15000);
  })();
}
