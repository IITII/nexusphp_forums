// ==UserScript==
// @name         fsm 个人信息下拉框调整
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  目前这个下拉框有样式问题，稍微调了一下
// @author       IITII
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @match        https://fsm.name/*
// @icon         https://avatars.githubusercontent.com/u/33705067?v=4
// @grant        none
// ==/UserScript==


(async function () {
    'use strict';
    jQuery("ul[class*='dropdown-menu']:contains('个人')").css({ left: 'initial', right: 0 })
})();