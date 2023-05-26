class Background {
  constructor() {
    this.isFocus = true; // 是否在前台
    this.time = null;
    this.timer = null;
    this.records = []; // 记录接口信息
    this.jiraNotify = false; // jira提醒开关
    this.jiraList = {}; // jira列表
    this.jiraMap = {};

    // 监听浏览器请求
    chrome.webRequest.onBeforeRequest.addListener(this.formatRequestBody, { urls: ['<all_urls>'], types: ['xmlhttprequest'] }, ['requestBody']);

    // 监听浏览器弹出窗口打开事件
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        chrome.storage.local.get('length', (res) => {
          const length = res.length || 20;
          chrome.runtime.sendMessage({ type: 1, data: { records: this.records, length } });
        });
      }
    });

    // 监听popup及content消息
    chrome.runtime.onMessage.addListener(({ type, data }, sender, sendResponse) => {
      switch (type) {
        case 2:
          // 清空抓包记录
          this.records = [];
          break;

        case 4:
          // 标记已读
          chrome.storage.local.set({ jiraMap: this.jiraMap });
          break;

        case 5:
          // 修改缓存数量
          this.records = records.slice(-data);
          chrome.storage.local.set({ length: data });
          chrome.storage.local.get('length', (res) => {
            const length = res.length || 20;
            chrome.runtime.sendMessage({ type: 1, data: { records: this.records, length } });
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

    // 监听浏览器切换前后台
    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.isFocus = windowId !== -1;
      if (this.isFocus) {
        const now = Date.now();
        if (now - this.time > 15000) {
          setTimeout(() => {
            this.queryJira();
          }, 500);
        }
        this.timer = setInterval(() => {
          this.queryJira();
        }, 15000);
      } else {
        clearInterval(this.timer);
      }
    });

    setTimeout(() => {
      this.queryJira();
      this.timer = setInterval(() => {
        this.queryJira();
      }, 15000);
    }, 500);
  }

  // 获取cookie
  getCookie() {
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
  }

  // 格式化请求体
  formatRequestBody = async ({ url, method, requestBody }) => {
    const cookie = await this.getCookie();
    let data = {};
    if (method === 'POST' || method === 'PUT') {
      const buffer = requestBody && requestBody.raw && requestBody.raw[0].bytes;
      if (buffer) {
        const decoder = new TextDecoder();
        const str = decoder.decode(new Uint8Array(buffer));
        try {
          data = JSON.parse(str);
        } catch (error) {
          data = str;
        }
      }
    } else {
      const query = url.split('?')[1];
      if (query) {
        const params = query.split('&');
        params.forEach((e) => {
          const temp = e.split('=');
          data[temp[0]] = temp[1];
        });
      }
    }
    chrome.storage.local.get('length', async (res) => {
      const length = res.length || 20;
      this.records.push({
        method,
        url,
        data,
        cookie,
      });
      this.records = this.records.slice(-length);
    });
  };

  // 发起通知
  notify(map) {
    const keys = Object.keys(map);
    let data = keys.map((key) => {
      return { key: key, value: map[key] };
    });
    // 通知content
    keys.length &&
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && !tabs[0].url.startsWith('chrome://')) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 3, data });
        }
      });
  }

  // 从string中提取jira列表
  formatJira(str) {
    this.jiraMap = {};
    const regex = /<td\s+class="summary">\s*<p>(\s*<a[^>]+>(.*?)<\/a>\s*)*<\/p>\s*<\/td>/g;
    const results = str.match(regex);
    results.forEach((e) => {
      const regex = /<a.*?href="(.*?)".*?>(.*?)<\/a>/g;
      const temp = e.match(regex).pop();
      const match = regex.exec(temp);
      const href = match[1];
      const text = match[2];
      // 缓存jira列表
      this.jiraMap[href] = text;
    });
    chrome.storage.local.get('jiraMap', (res) => {
      const tempMap = JSON.parse(JSON.stringify(this.jiraMap));
      Object.keys(res.jiraMap || {}).forEach((key) => {
        delete tempMap[key];
      });
      this.isFocus && this.notify(tempMap);
    });
  }

  // 获取jira分配给我的信息
  queryJira() {
    this.time = Date.now();
    fetch(
      `https://jira.internal.pingxx.com/rest/gadget/1.0/issueTable/jql?num=10&tableContext=jira.table.cols.dashboard&addDefault=false&columnNames=issuetype&columnNames=issuekey&columnNames=summary&columnNames=assignee&columnNames=reporter&columnNames=status&columnNames=priority&enableSorting=true&paging=true&showActions=true&jql=assignee+%3D+currentUser()+AND+resolution+%3D+unresolved+ORDER+BY+priority+DESC%2C+created+ASC&sortBy=&startIndex=0&_=${Date.now()}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (data?.table) {
          this.formatJira(data?.table);
        } else {
          // 未登陆 登陆过期
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { type: 6 });
            }
          });
        }
      })
      .catch(() => {});
  }
}

new Background();
