// ==UserScript==
// @name         观众banner美化
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  个人觉得这个banner太大了，稍微调整下样式。想直接隐藏就把下面的 100px 改成 0px
// @author       IITII
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @match        https://audiences.me/*
// @icon         https://avatars.githubusercontent.com/u/33705067?v=4
// @grant        none
// ==/UserScript==


(async function () {
    'use strict';
    jQuery("div[class*='banner']").height('100px')
})();
