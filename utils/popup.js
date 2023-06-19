let listMap = [];

// 建立与 background.js 的通信连接
const port = chrome.runtime.connect({
    name: 'popup',
});

// 加密
const encryptParams = (params, cookie) => {
    const data = CryptoJS.enc.Utf8.parse(params);
    const key = CryptoJS.enc.Utf8.parse(cookie);
    const encrypted = CryptoJS.AES.encrypt(data, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    });
    return encrypted.toString();
};

// 解密
const decryptParams = (data, cookie) => {
    if (!data.enc_data) {
        return data;
    }
    try {
        const key = CryptoJS.enc.Utf8.parse(cookie);
        const decipher = CryptoJS.AES.decrypt(data.enc_data, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7,
        });
        const plaintext = decipher.toString(CryptoJS.enc.Utf8);
        return JSON.parse(plaintext);
    } catch (error) {
        return { msg: '解码异常', error };
    }
};

// 创建dom
const createListDom = (list) => {
    const temp = list.map((e) => {
        return `<div class="row" data-index="${e.i}"><div class="td">${e.i + 1}</div><div class="td">${e.method}</div><div class="td" title="${e.url}">${e.url}</div></div>`;
    });
    $('#list').html(temp.join(''));
    var element = $('#list');
    var height = element[0] && element[0].scrollHeight;
    element.scrollTop(height);
};

const initRecords = (records) => {
    const list = records.map((e, i) => {
        return {
            ...e,
            i,
            data: decryptParams(e.data, e.cookie),
        };
    });
    listMap = list;
    createListDom(listMap);
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
            $('.key-words').val(data.keyWords);
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
        const reg1 = /^[1-9][0-9]{9}$/gm;
        const reg2 = /^[1-9][0-9]{12}$/gm;
        $('#json-inner')
            .find('.json-string')
            .each((i, e) => {
                const unix = $(e).text().replace(/['"]/g, '');
                if (reg1.test(unix) || reg2.test(unix)) {
                    const date = new Date(Number(unix));
                    $(e).attr('title', date.toLocaleString());
                }
            });
        $('#json-inner')
            .find('.json-literal')
            .each((i, e) => {
                const unix = $(e).text().replace(/['"]/g, '');
                if (reg1.test(unix) || reg2.test(unix)) {
                    const date = new Date(Number(unix));
                    $(e).attr('title', date.toLocaleString());
                }
            });
    }, 50);
});

$('.filter-btn').on('click', (e) => {
    const keyWords = $('.key-words').val();
    createListDom([]);
    $('#json-renderer').html('');
    $('#json-inner').html('');
    chrome.runtime.sendMessage({ type: 7, data: keyWords });
});

$('.clear-btn').click(() => {
    listMap = [];
    createListDom([]);
    $('#json-renderer').html('');
    $('#json-inner').html('');
    chrome.runtime.sendMessage({ type: 2 });
});

$('.jiemi .copy').click(() => {
    const str = $('#json-inner').text();
    copyToClipboard(str);
});

$('body').on('click', '.func i', (e) => {
    $('.func .iconfont').removeClass('active');
    $(e.target).addClass('active');
    const className = $(e.target).data('class-name');
    $(`.func-container .${className}`).show().siblings().hide();
    if (className === 'shijian') {
        $('.unix-input').attr('placeholder', Date.now());
    }
});

$('body').on('input', '.json-str-textarea', (e) => {
    try {
        const json = JSON.parse(e.target.value);
        setTimeout(() => {
            $('#json-json-inner').jsonViewer(json, {
                collapsed: $('#collapsed').is(':checked'),
                withQuotes: $('#with-quotes').is(':checked'),
            });
            const reg1 = /^[1-9][0-9]{9}$/gm;
            const reg2 = /^[1-9][0-9]{12}$/gm;
            $('#json-json-inner')
                .find('.json-string')
                .each((i, e) => {
                    const unix = $(e).text().replace(/['"]/g, '');
                    if (reg1.test(unix) || reg2.test(unix)) {
                        const date = new Date(Number(unix));
                        $(e).attr('title', date.toLocaleString());
                    }
                });
            $('#json-json-inner')
                .find('.json-literal')
                .each((i, e) => {
                    const unix = $(e).text().replace(/['"]/g, '');
                    if (reg1.test(unix) || reg2.test(unix)) {
                        const date = new Date(Number(unix));
                        $(e).attr('title', date.toLocaleString());
                    }
                });
        }, 50);
    } catch (e) {}
});

$('.json .copy').click(() => {
    const str = $('#json-json-inner').text();
    copyToClipboard(str);
});

$('.unix-input').on('input', (e) => {
    const unix = e.target.value;
    const date = new Date(Number(unix));
    $('.date').text(date.toLocaleString());
});

$('.date-input').on('input', (e) => {
    const date = new Date(e.target.value);
    $('.unix').text(date.getTime());
});
