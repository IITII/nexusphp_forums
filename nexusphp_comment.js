// ==UserScript==
// @name         NexusPHP 帖子评论收集
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  NexusPHP 帖子评论收集, 主要用于发药时过滤邀请人. 有问题请在 Github 反馈: https://github.com/IITII/nexusphp_forums
// @author       IITII
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @match        https://**/forums.php*
// @icon         https://avatars.githubusercontent.com/u/33705067?v=4
// @grant        none
// @todo         做种条数, 本站 email, 用户被警告
// ==/UserScript==

(async function () {
  'use strict';
  const reqBreak = 1000
  let isDebug = false, getSeedingSize = true
  let href, curr_url, title, currPage, finalPage, rawComment = [], filterComArr = [], sep = '|', filterSep = ',', stopped = true
  async function sleep(ms) {
    console.log(`sleep ${ms}ms`);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function sizeToGB(size, unit = 'mb', defUnit = 'gb') {
    const singleUnit = 1000,
      units = {
        b: 1 / singleUnit,
        kb: singleUnit,
        mb: singleUnit * singleUnit,
        gb: singleUnit * singleUnit * singleUnit,
        tb: singleUnit * singleUnit * singleUnit * singleUnit,
        pb: singleUnit * singleUnit * singleUnit * singleUnit * singleUnit,
      }
    unit = unit.toLowerCase()
    unit = unit.replace('ib', 'b')
    size = parseFloat(size)
    let curUnit = units[unit]
    if (!curUnit) {
      throw new Error(`unknown unit: ${unit}`)
    }
    return +(size * curUnit / units[defUnit]).toFixed(2)
  }
  function sizeToGBWithBreak(str, withBreak = /\s+/) {
    let [size, unit] = str.split(withBreak)
    return sizeToGB(size, unit)
  }
  /**
   * 创建下载文件
   * @param {String} fileName     文件名称
   * @param {String} fileContent  文件内容
   * @return {String}
   */
  function createAndDownloadFile(fileName, fileContent) {
      if (!fileName) {
          return '文件名称为空';
      }
      if (typeof fileName !== 'string') {
          return '文件名类型错误';
      }
      if (!fileContent) {
          return '文件内容为空';
      }
      if (typeof fileContent !== 'string') {
          fileContent = JSON.stringify(fileContent);
      }
  
      // 创建隐藏a标签
      let aTag = document.createElement('a')
      // 将文件内容转成blob对象
      let blob = new Blob([fileContent])
      // 设置下载文件名
      aTag.download = fileName;
      // 给a标签创建DOMString
      aTag.href = URL.createObjectURL(blob)
      // 模拟点击、下载
      aTag.click()
      // 释放DOMString
      URL.revokeObjectURL(blob)
      return ''
  }
  

  async function page(html = document) {
    let jq = jQuery(html)
    let userInfos, seedingSizes = [], userAddInfos, postBodys
    userInfos = jq.find("table[id*='pid']").map(function () {
      let $ = jQuery(this)
      let floor, uid, userInfo, username, user_level, status, user_details_link, comment_time
      floor = $.find("a:contains('#')").text()
      comment_time = $.find("span[title]").attr('title')
      userInfo = $.find("span[class='nowrap']")
      if (userInfo.text().match(/(無此帳戶|无此账户)/)) {
        status = 'banned'
        username = 'banned'
        user_level = 'Peasant_Name'
        user_details_link = 'banned'
        uid = -1
      } else {
        status = '正常'
        username = userInfo.find("a[class*='_Name']").text()
        user_level = userInfo.find("a[class*='_Name']").attr('class')
        user_details_link = userInfo.find("a[class*='_Name']")[0].href
        uid = new URL(user_details_link).searchParams.get('id')
        uid = +uid
      }
      return { floor, uid, username, user_level, status, user_details_link, comment_time }
    }).toArray()
    //
    for (const info of userInfos) {
      let size = 0
      if (info.uid > 0) {
        if (getSeedingSize) {
          size = await seedingSize(info.uid)
          await sleep(reqBreak)
        } else {
          size = '未获取'
        }
      }
      seedingSizes.push(size)
    }
    userAddInfos = jq.find("td[class='rowfollow']td[align='left']").toArray().map(_ => _.innerText)
    postBodys = jq.find("div[id*='pid']").toArray().map(_ => _.innerText)
    for (let i = 0; i < userInfos.length; i++) {
      let {floor, uid, username, user_level, status, user_details_link, comment_time} = userInfos[i]
      let seedingSize = seedingSizes[i], userAddInfo = userAddInfos[i], upload, download, shareRate,
       postBody = postBodys[i], preId, preEmail
      rawComment.push([floor, uid, username, user_level, status, user_details_link, comment_time, seedingSize,
        userAddInfo, postBody].join(sep))
      if (postBody.match(/引用/) || !postBody.match(/(注册(用户名|id)|(邮箱|email))/ig) || status !== '正常') {
        console.log(`skip -> ${status} -> ${postBody}`)
        continue
      }
      user_level = user_level.replace(/_Name/g, '')
      upload = userAddInfo.split(/\n+/).find(_ => _.match(/上/)).replace(/上[傳传][：:]/g, '').trim()
      download = userAddInfo.split(/\n+/).find(_ => _.match(/下/)).replace(/下[載载][：:]/g, '').trim()
      shareRate = userAddInfo.split(/\n+/).find(_ => _.match(/分/)).replace(/分享率[：:]/g, '').trim()
      upload = sizeToGBWithBreak(upload)
      download = sizeToGBWithBreak(download)
      let regex = /注册(用户名|id)[：:]/ig
      preId = postBody.split(/\n+/).find(_ => _.match(regex))
      if (!preId) {
        console.log(`skip -> ${postBody}`)
        continue
      }
      preId = preId.replace(regex, ' ').trim().split(/\s+/).pop()
      regex = /(邮箱|email)[：:]/ig
      preEmail = postBody.split(/\n+/).filter(_ => _.match(regex)).find(_ => _.match(/[a-z0-9]@[a-z0-9]+\./ig))
        .replace(/(邮箱|email)[：:]/ig, ' ').trim().split(/\s+/).pop()

      filterComArr.push([floor, uid, username, user_level, status, seedingSize, comment_time,
        upload, download, shareRate, preId, preEmail, user_details_link].join(filterSep))
    }
  }

  // 获取用户做种大小
  async function seedingSize(uid, maxPage = 100000) {
    let seedingIds = [], seedingArr = [], seedingSize = 0, err = false, errText = ''
    for (let i = 0; i < maxPage; i++) {
      let url = `/getusertorrentlistajax.php?userid=${uid}&type=seeding&page=${i}`
      let rawHtml
      try {
        await jQuery.get(url).done(res => {
          if (res.match(/上[傳传]/)) {
            rawHtml = res
          } else {
            err = true
            errText = res
            console.log(`request to ${url} failed: ${res}`);
          }
        })
      } catch (e) {
        if (e.responseText.match(/上[傳传]/)) {
          rawHtml = e.responseText
        } else {
          err = true
          errText = e.responseText
          console.log(`${e.statusText} -> ${e.responseText}`)
        }
      }
      if (err) {
        // return -1
        return errText
      }
      let jq = jQuery(`<div id='jq'>${rawHtml}</div>`)
      let totalSize = jq.find("div:contains('总大小')")
      // let prePageSize = 0, pageSize = 100
      if (totalSize.length === 0) {
        let torrIds, torrents
        torrIds = jq.find("table[width='100%'] tr td[class='rowfollow']:nth-child(2) a")
        torrents = jq.find("table[width='100%'] tr td[class='rowfollow']:nth-child(3)")
        if (torrents.length === 0) {
          // if (torrents.length === 0 || torrents.length < prePageSize) {
          console.log(`maybe currPage: ${i} is the last`)
          break
        } else {
          torrIds = torrIds.toArray().map(_ => _.href).map(_ => new URL(_).searchParams.get('id'))
          torrents = torrents.toArray().map(_ => _.innerText)
          let diff = []
          for (let i = 0; i < torrIds.length; i++) {
            const id = torrIds[i];
            const torrent = torrents[i];
            if (seedingIds.indexOf(id) > 0) {
              console.log(`skip torrent id: ${id} ${torrent}`)
            } else {
              seedingIds.push(id)
              diff.push(torrent)
            }
          }
          if (diff.length == 0) {
            console.log(`maybe curr seeding Page: ${i} is the last`)
            break
          } else {
            seedingArr = seedingArr.concat(diff)
          }
        }
      } else {
        let [size, unit] = jq.find("div:contains('总大小'):first").text().split('|').pop().replace(/总大小[：:]/g, '').trim().split(/\s+/)
        totalSize = sizeToGB(size, unit)
        seedingSize = totalSize
        return seedingSize
      }
      await sleep(reqBreak)
    }
    seedingSize = seedingArr.map(_ => _.toLowerCase()).map(_ => _.split('\n'))
      .map(([size, unit]) => sizeToGB(size, unit)).reduce((a, b) => a + b, 0)
    return seedingSize
  }

  async function main() {
    rawComment = []
    filterComArr = []
    rawComment.push('楼层,uid,用户名,用户详情页,用户等级,做种大小GB,评论时间,额外信息,评论内容'.split(',').join(sep))
    // 用户状态: 正常, 被ban, 警告
    filterComArr.push('楼层,uid,用户名,用户等级,用户状态,做种大小GB,评论时间,上传量GB,下载量GB,分享率,预注册 ID,预注册邮箱,用户详情页'.split(',').join(filterSep))
    href = window.location.href
    curr_url = new URL(href)
    title = jQuery(".embedded:contains('->')").text()
    currPage = window.currentpage || +curr_url.searchParams.get('page') || 0
    finalPage = jQuery("a[href*='?action=viewtopic']a[href*='page=']").toArray().map(_ => _.href)
    finalPage = finalPage.filter(_ => !_.includes('&page=p'))
    finalPage = [...new Set(finalPage)]
    finalPage = finalPage.map(_ => +new URL(_).searchParams.get('page') || 0)
    finalPage = finalPage.sort().pop() || 0
    finalPage = isDebug ? Math.min(0, finalPage) : finalPage
    let i = currPage
    do {
      console.log(`currPage: ${i} -> final: ${finalPage}`);
      let html
      if (i === currPage) {
        html = document
      } else {
        curr_url.searchParams.set('page', i)
        html = await jQuery.get(curr_url.toString())
      }
      await page(html)
      await sleep(reqBreak)
      i += 1
    } while (!stopped && i <= finalPage)

    // console.log(rawComment)
    // console.log(rawComment.map(_ => _.join(',')).join('\n'))
    // console.log(filterComArr.join('\n'))
    createAndDownloadFile("raw.csv", rawComment.join('\n'))
    createAndDownloadFile("filtered.csv", filterComArr.map(_ => _.split(sep).join(filterSep)).join('\n'))
  }

  const button = document.createElement("button");
  button.textContent = "收集评论";
  button.setAttribute("type", "button");
  button.setAttribute("style", "position: fixed;display: block;top: 1px;width: 120px;height: 30px;");
  document.body.appendChild(button);
  button.addEventListener("click", async function () {
    button.disabled = true
    if (window.confirm('日志输出到 F12，请打开查看，执行完成后按钮可用, 刷新页面即可取消执行')) {
      await main()
    } else {
      alert('用户主动取消')
    }
    button.disabled = false
  });

})();
