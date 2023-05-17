let listMap = [];
let urlMap = [];
// 获取cookie
let cookie = '';
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.cookies.getAll({ url: tabs[0].url }, (cookies) => {
    const authorization = cookies.find((e) => e.name === '_authorization');
    if (authorization && authorization.value) {
      cookie = authorization.value;
    }
  });
});
// 建立与 background.js 的通信连接
const port = chrome.runtime.connect({
  name: 'popup',
});

// 加密
const encryptParams = (params) => {
  const data = CryptoJS.enc.Utf8.parse(params);
  const key = CryptoJS.enc.Utf8.parse(cookie.slice(cookie.length - 16));
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
};

// 解密
const decryptParams = (encryptedParams) => {
  try {
    const key = CryptoJS.enc.Utf8.parse(cookie.slice(cookie.length - 16));
    const decipher = CryptoJS.AES.decrypt(encryptedParams, key, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plaintext = decipher.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  } catch (error) {
    console.log(error);
    return { error: '解码异常' };
  }
};

// 创建dom
const createListDom = (list) => {
  const temp = list.map((e) => {
    return `<div class="row" data-index="${e.i}"><div class="td">${e.i + 1}</div><div class="td">${e.method}</div><div class="td" title="${e.url}">${e.url}</div></div>`;
  });
  $('#list').html(temp.join(''));
  var element = $('#list');
  var height = element[0].scrollHeight;
  element.scrollTop(height);
};

const createOpsDom = (list) => {
  const temp = list.map((e) => {
    return `<option value="${e}">${e}</option>`;
  });
  $('.url-select').html('<option value="">全部</option>' + temp.join(''));
};

const initRecords = (records) => {
  const list = records.map((e, i) => {
    !urlMap.includes(e.url) && urlMap.push(e.url);
    return {
      ...e,
      i,
      data: e.data.enc_data ? decryptParams(e.data.enc_data) : e.data,
    };
  });
  listMap = list;
  createListDom(listMap);
  createOpsDom(urlMap);
};

const copyToClipboard = (text) => {
  const input = document.createElement('textarea');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  document.body.removeChild(input);
};

chrome.runtime.onMessage.addListener(({ type, data }, sender, sendResponse) => {
  switch (type) {
    case 1:
      $('.cache-length').val(data.length || 20);
      initRecords(data.records);
      break;

    default:
      break;
  }
});

$('#list').on('click', '.row', function () {
  Array.from($('.row')).map((e) => {
    $(e).removeClass('selected');
  });
  $(this).addClass('selected');
  $('#json-inner').jsonViewer(
    {},
    {
      collapsed: $('#collapsed').is(':checked'),
      withQuotes: $('#with-quotes').is(':checked'),
    }
  );
  setTimeout(() => {
    const i = $(this).data('index');
    $('#json-inner').jsonViewer(listMap[i].data, {
      collapsed: $('#collapsed').is(':checked'),
      withQuotes: $('#with-quotes').is(':checked'),
    });
  }, 50);
});

$('.url-select').on('change', (e) => {
  let temp = [];
  if (e.target.value === '') {
    temp = listMap;
  } else {
    temp = listMap.filter(({ url }) => url === e.target.value);
  }
  createListDom(temp);
});

$('.clear-all').click(() => {
  listMap = [];
  urlMap = [];
  createListDom([]);
  createOpsDom([]);
  $('#json-renderer').html('');
  chrome.runtime.sendMessage({ type: 2 }, (response) => {
    // 处理响应
  });
});

$('.cache-length').on('change', () => {
  const length = $('.cache-length').val();
  chrome.runtime.sendMessage({ type: 5, data: length });
});

$('.copy').click(() => {
  const str = $('#json-inner').text();
  copyToClipboard(str);
});
